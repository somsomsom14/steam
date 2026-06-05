import { generateText } from "../gemini";
import {
  collectPreviouslyRecommendedAppIds,
  getOwnedAppIds,
  getOwnedNames,
  isMoreRecommendRequest,
  isOwnedGame,
  serializeGameRecommendMessage,
} from "../game-recommend-utils";
import { formatTendencyForPrompt, summarizeTopGames, aggregateTagPlaytime } from "../user-tendency";
import { searchSteamStoreAppId } from "@/lib/steam";
import type { ChatHistoryMessage, GameRecommendItem, UserGameRecord } from "../types";

const SYSTEM = `당신은 Steam 게임 추천 전문 Agent입니다.
반드시 아래 JSON 형식만 출력하세요. 다른 텍스트 금지.

{"intro":"한 줄 요약","games":[{"name":"정확한 Steam 스토어 게임명","reason":"추천 이유 1~2문장"}]}

규칙:
- games 배열은 정확히 2개
- name에는 Steam PC 게임의 정확한 상품명만 (appid·URL·이미지 URL 출력 금지)
- [이미 보유] 또는 [이전 추천] 목록의 게임은 절대 포함하지 않음
- intro는 친근한 한국어 한 줄`;

type RawRec = { name?: string; reason?: string };

/**
 * Gemini 게임명 → Steam Store Search API(게임당 1회) → appid
 * 썸네일·상점 링크는 UI에서 appid로 조합
 */
async function resolveOneRecommendation(
  raw: RawRec,
  ownedAppIds: Set<number>,
  ownedNames: Set<string>,
  usedAppIds: Set<number>
): Promise<GameRecommendItem | null> {
  const name = raw.name?.trim();
  const reason = raw.reason?.trim();
  if (!name || !reason) return null;
  if (isOwnedGame(null, name, ownedAppIds, ownedNames)) return null;

  const appid = await searchSteamStoreAppId(name);
  if (!appid || usedAppIds.has(appid) || isOwnedGame(appid, name, ownedAppIds, ownedNames)) {
    return null;
  }

  usedAppIds.add(appid);
  return { appid, name, reason };
}

async function resolveRecommendations(
  rawGames: RawRec[],
  ownedAppIds: Set<number>,
  ownedNames: Set<string>,
  excludeAppIds: Set<number>
): Promise<GameRecommendItem[]> {
  const usedAppIds = new Set<number>([...ownedAppIds, ...excludeAppIds]);
  const results: GameRecommendItem[] = [];

  for (const raw of rawGames) {
    if (results.length >= 2) break;
    const item = await resolveOneRecommendation(raw, ownedAppIds, ownedNames, usedAppIds);
    if (item) results.push(item);
  }

  return results;
}

export async function buildGameRecommendMessage(params: {
  userMessage: string;
  games: UserGameRecord[];
  history: ChatHistoryMessage[];
}): Promise<string> {
  const ownedAppIds = getOwnedAppIds(params.games);
  const ownedNames = getOwnedNames(params.games);
  const prevRecommended = collectPreviouslyRecommendedAppIds(params.history);
  const excludeAppIds = new Set([...ownedAppIds, ...prevRecommended]);
  const more = isMoreRecommendRequest(params.userMessage);

  const ownedList = params.games
    .map((g) => `${g.appid}: ${g.game_name ?? `App ${g.appid}`}`)
    .slice(0, 120)
    .join("\n");

  const excludedList = [...excludeAppIds]
    .slice(0, 80)
    .map((id) => String(id))
    .join(", ");

  const tendencies = aggregateTagPlaytime(params.games, 10);

  const prompt = `[사용자 플레이 성향 — 태그별 상위]
${formatTendencyForPrompt(tendencies)}

[플레이 시간 상위 게임]
${summarizeTopGames(params.games)}

[이미 보유한 게임 — 추천 금지]
${ownedList || "(없음)"}

[이전에 추천했거나 제외할 appid — 추천 금지]
${excludedList || "(없음)"}

[사용자 요청]
${params.userMessage}
${more ? "\n(이전과 다른 새로운 게임 2개를 추천하세요.)" : ""}

위 조건을 지켜 JSON만 출력하세요.`;

  const raw = await generateText(prompt, SYSTEM);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return "게임 추천을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }

  let parsed: { intro?: string; games?: RawRec[] };
  try {
    parsed = JSON.parse(jsonMatch[0]) as { intro?: string; games?: RawRec[] };
  } catch {
    return "게임 추천을 파싱하지 못했습니다. 다시 요청해 주세요.";
  }

  const resolved = await resolveRecommendations(
    parsed.games ?? [],
    ownedAppIds,
    ownedNames,
    excludeAppIds
  );

  if (resolved.length === 0) {
    return more
      ? "추가로 추천할 새 게임을 찾지 못했습니다. 다른 장르나 조건으로 다시 물어봐 주세요."
      : "조건에 맞는 미보유 게임을 찾지 못했습니다. Steam 동기화 후 다시 시도해 주세요.";
  }

  const intro =
    parsed.intro?.trim() ||
    (more ? "다른 게임 2개를 골라봤어요!" : "당신 취향에 맞는 게임 2가지예요!");

  return serializeGameRecommendMessage(intro, resolved);
}

export async function* runGameRecommendAgent(params: {
  userMessage: string;
  games: UserGameRecord[];
  history: ChatHistoryMessage[];
}): AsyncGenerator<string> {
  const message = await buildGameRecommendMessage(params);
  yield message;
}
