import { generateText } from "../gemini";
import { serializeRoomRecommendMessage } from "../room-recommend-utils";
import { aggregateTagPlaytime, formatTendencyForPrompt, summarizeTopGames } from "../user-tendency";
import type { ChatHistoryMessage, RoomForRecommend, RoomRecommendItem, UserGameRecord } from "../types";

const MAX_ROOMS = 3;

const SYSTEM = `당신은 MI-TEAM 방(팀 매칭) 추천 Agent입니다.
반드시 아래 JSON 형식만 출력하세요. 마크다운·**볼드**·섹션 제목(예: 추천 방) 금지.

{"intro":"한 줄 요약","rooms":[{"id":"방 uuid","reason":"추천 이유 1~2문장"}]}

규칙:
- rooms는 1~${MAX_ROOMS}개, [현재 방 목록]에 있는 id만 사용 (uuid 정확히 복사)
- 사용자가 특정 게임을 언급하면 그 게임 방을 최우선
- intro·reason은 친근한 한국어
- 맞는 방이 없으면 {"intro":"...","rooms":[]} 만 출력`;

function formatRooms(rooms: RoomForRecommend[]): string {
  if (rooms.length === 0) return "현재 등록된 방이 없습니다.";
  return rooms
    .map(
      (r, i) =>
        `${i + 1}. id=${r.id} | [${r.game_name}] ${r.title}${r.subtitle ? ` — ${r.subtitle}` : ""} | 태그: ${r.tags.join(", ") || "없음"} | 인원: ${r.member_count}명`
    )
    .join("\n");
}

function parseRecommendJson(raw: string): { intro?: string; rooms?: { id?: string; reason?: string }[] } | null {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]) as { intro?: string; rooms?: { id?: string; reason?: string }[] };
  } catch {
    return null;
  }
}

function resolveRoomItems(
  rawRooms: { id?: string; reason?: string }[],
  available: RoomForRecommend[]
): RoomRecommendItem[] {
  const byId = new Map(available.map((r) => [r.id, r]));
  const results: RoomRecommendItem[] = [];
  const seen = new Set<string>();

  for (const raw of rawRooms) {
    if (results.length >= MAX_ROOMS) break;
    const id = raw.id?.trim();
    const reason = raw.reason?.trim();
    if (!id || !reason || seen.has(id)) continue;

    const room = byId.get(id);
    if (!room) continue;

    seen.add(id);
    results.push({
      id: room.id,
      title: room.title,
      subtitle: room.subtitle,
      game_name: room.game_name,
      game_appid: room.game_appid,
      member_count: room.member_count,
      tags: room.tags,
      reason,
    });
  }

  return results;
}

export async function buildRoomRecommendMessage(params: {
  userMessage: string;
  games: UserGameRecord[];
  rooms: RoomForRecommend[];
  history: ChatHistoryMessage[];
}): Promise<string> {
  void params.history;

  const tendencies = aggregateTagPlaytime(params.games, 8);

  const prompt = `[사용자 보유 게임 (플레이 타임 상위)]
${summarizeTopGames(params.games)}

[사용자 플레이 성향]
${formatTendencyForPrompt(tendencies)}

[현재 방 목록]
${formatRooms(params.rooms)}

[사용자 요청]
${params.userMessage}

위 조건에 맞는 방 id만 골라 JSON만 출력하세요.`;

  const raw = await generateText(prompt, SYSTEM);
  const parsed = parseRecommendJson(raw);

  if (!parsed) {
    return "방 추천을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }

  const intro =
    parsed.intro?.trim() ||
    (params.rooms.length === 0 ?
      "아직 등록된 방이 없어요. 원하는 게임으로 방을 만들어 보세요!"
    : "취향에 맞는 방을 골라봤어요!");

  if (params.rooms.length === 0) {
    return intro;
  }

  const items = resolveRoomItems(parsed.rooms ?? [], params.rooms);
  if (items.length === 0) {
    return (
      intro ||
      "지금 등록된 방 중에 잘 맞는 방을 찾지 못했어요. 새 방을 만들거나 방 찾기에서 직접 둘러보세요."
    );
  }

  return serializeRoomRecommendMessage(intro, items);
}

export async function* runRoomRecommendAgent(params: {
  userMessage: string;
  games: UserGameRecord[];
  rooms: RoomForRecommend[];
  history: ChatHistoryMessage[];
}): AsyncGenerator<string> {
  const message = await buildRoomRecommendMessage(params);
  yield message;
}
