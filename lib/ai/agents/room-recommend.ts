import { streamChatResponse } from "../gemini";
import { formatTendencyForPrompt } from "../user-tendency";
import type { ChatHistoryMessage, RoomForRecommend, UserGameRecord } from "../types";
import { aggregateTagPlaytime } from "../user-tendency";

const SYSTEM = `당신은 MI-TEAM 방(팀 매칭) 추천 Agent입니다.
사용자 성향과 현재 등록된 방 목록을 비교해 가장 잘 맞는 방 1~3개를 추천합니다.
한국어로 답변하고, 각 방의 제목·게임·태그·인원을 언급하며 추천 이유를 설명합니다.
방이 없거나 적합한 방이 없으면 어떤 조건의 방을 만들면 좋을지 제안합니다.`;

function formatRooms(rooms: RoomForRecommend[]): string {
  if (rooms.length === 0) return "현재 등록된 방이 없습니다.";
  return rooms
    .map(
      (r, i) =>
        `${i + 1}. [${r.game_name}] ${r.title}${r.subtitle ? ` — ${r.subtitle}` : ""} | 태그: ${r.tags.join(", ") || "없음"} | 인원: ${r.member_count}명 | id: ${r.id}`
    )
    .join("\n");
}

export async function* runRoomRecommendAgent(params: {
  userMessage: string;
  games: UserGameRecord[];
  rooms: RoomForRecommend[];
  history: ChatHistoryMessage[];
}): AsyncGenerator<string> {
  const tendencies = aggregateTagPlaytime(params.games, 8);

  const prompt = `[사용자 플레이 성향]
${formatTendencyForPrompt(tendencies)}

[현재 방 목록]
${formatRooms(params.rooms)}

[사용자 요청]
${params.userMessage}

성향에 맞는 방을 추천해 주세요.`;

  yield* streamChatResponse({
    systemInstruction: SYSTEM,
    userPrompt: prompt,
    history: params.history,
  });
}
