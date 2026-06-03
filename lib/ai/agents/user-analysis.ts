import { streamChatResponse } from "../gemini";
import {
  aggregateGenrePlaytime,
  aggregateTagPlaytime,
  formatTendencyForPrompt,
  summarizeTopGames,
} from "../user-tendency";
import type { ChatHistoryMessage, UserGameRecord } from "../types";

const SYSTEM = `당신은 Steam 플레이 성향 분석 Agent입니다.
태그·장르·플레이타임 데이터를 바탕으로 사용자의 게이머 성향을 자연스러운 한국어로 설명합니다.
2~4문단, 친근한 톤. 상위 성향 5개를 반드시 반영합니다.
예: "당신은 협동 게임을 즐기는 플레이어예요. Co-op, 멀티플레이 위주로..."`;

export async function* runUserAnalysisAgent(params: {
  userMessage: string;
  games: UserGameRecord[];
  history: ChatHistoryMessage[];
}): AsyncGenerator<string> {
  const tagTendencies = aggregateTagPlaytime(params.games, 5);
  const genreTendencies = aggregateGenrePlaytime(params.games, 5);

  const prompt = `[태그별 상위 성향 5]
${formatTendencyForPrompt(tagTendencies)}

[장르별 상위]
${formatTendencyForPrompt(genreTendencies)}

[플레이 시간 상위 게임]
${summarizeTopGames(params.games, 10)}

[사용자 요청]
${params.userMessage}

위 데이터로 이 사용자의 게이머 성향을 분석해 설명해 주세요.`;

  yield* streamChatResponse({
    systemInstruction: SYSTEM,
    userPrompt: prompt,
    history: params.history,
  });
}
