import { classifyIntent, GENERAL_INQUIRY_SYSTEM } from "./orchestrator";
import { fetchRoomsForRecommend, fetchUserGames } from "./data";
import { streamChatResponse } from "./gemini";
import { runGameRecommendAgent } from "./agents/game-recommend";
import { runRoomRecommendAgent } from "./agents/room-recommend";
import { runUserAnalysisAgent } from "./agents/user-analysis";
import type { ChatHistoryMessage, ChatIntent } from "./types";

export type PipelineMeta = {
  intent: ChatIntent;
};

/** Multi-Agent 파이프라인 — Orchestrator → 전문 Agent 또는 직접 응답 */
export async function* runChatPipeline(params: {
  userId: string;
  userMessage: string;
  history: ChatHistoryMessage[];
}): AsyncGenerator<string, PipelineMeta> {
  const intent = await classifyIntent(params.userMessage, params.history);
  const priorHistory = params.history;

  switch (intent) {
    case "게임추천": {
      const games = await fetchUserGames(params.userId);
      yield* runGameRecommendAgent({
        userMessage: params.userMessage,
        games,
        history: priorHistory,
      });
      return { intent };
    }
    case "방추천": {
      const [games, rooms] = await Promise.all([
        fetchUserGames(params.userId),
        fetchRoomsForRecommend(),
      ]);
      yield* runRoomRecommendAgent({
        userMessage: params.userMessage,
        games,
        rooms,
        history: priorHistory,
      });
      return { intent };
    }
    case "성향분석": {
      const games = await fetchUserGames(params.userId);
      yield* runUserAnalysisAgent({
        userMessage: params.userMessage,
        games,
        history: priorHistory,
      });
      return { intent };
    }
    case "일반문의":
    default: {
      yield* streamChatResponse({
        systemInstruction: GENERAL_INQUIRY_SYSTEM,
        userPrompt: params.userMessage,
        history: priorHistory,
      });
      return { intent: "일반문의" };
    }
  }
}
