import { streamChatResponse } from "../gemini";
import { formatTendencyForPrompt, summarizeTopGames } from "../user-tendency";
import type { ChatHistoryMessage, UserGameRecord } from "../types";
import { aggregateTagPlaytime } from "../user-tendency";

const SYSTEM = `당신은 Steam 게임 추천 전문 Agent입니다.
사용자의 플레이 성향(태그별 플레이타임)과 메시지에 담긴 조건을 모두 반영해 추천합니다.
한국어로 답변하고, 추천 게임 3~5개를 제목·이유·예상 재미 포인트와 함께 제시합니다.
실제 Steam 스토어에 있을 법한 게임명을 사용하세요. 데이터가 부족하면 동기화 안내를 짧게 덧붙입니다.`;

export async function* runGameRecommendAgent(params: {
  userMessage: string;
  games: UserGameRecord[];
  history: ChatHistoryMessage[];
}): AsyncGenerator<string> {
  const tendencies = aggregateTagPlaytime(params.games, 10);
  const prompt = `[사용자 플레이 성향 — 태그별 상위]
${formatTendencyForPrompt(tendencies)}

[플레이 시간 상위 게임]
${summarizeTopGames(params.games)}

[사용자 요청]
${params.userMessage}

위 성향과 요청 조건을 모두 반영해 Steam 게임을 추천해 주세요.`;

  yield* streamChatResponse({
    systemInstruction: SYSTEM,
    userPrompt: prompt,
    history: params.history,
  });
}
