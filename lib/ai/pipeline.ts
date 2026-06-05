import { runOrchestrator } from "./orchestrator";
import { fetchRoomsForRecommend, fetchUserDisplayName, fetchUserGames } from "./data";
import { runGameRecommendAgent } from "./agents/game-recommend";
import { runRoomRecommendAgent } from "./agents/room-recommend";
import { runUserAnalysisAgent } from "./agents/user-analysis";
import type { ChatHistoryMessage, ChatIntent } from "./types";

export type PipelineMeta = {
  intent: ChatIntent;
};

const GENERAL_FALLBACK =
  "MI-TEAM AI 상담소입니다. 게임 추천, 방 추천, Steam 성향 분석, 서비스 이용 문의를 도와드릴 수 있어요.";

/** Orchestrator(Gemini) → 전문 Agent 또는 일반 문의 직접 응답 */
export async function* runChatPipeline(params: {
  userId: string;
  userMessage: string;
  history: ChatHistoryMessage[];
}): AsyncGenerator<string, PipelineMeta> {
  const { intent, generalReply } = await runOrchestrator(params.userMessage, params.history);
  const priorHistory = params.history;

  if (intent === "일반문의") {
    yield generalReply?.trim() || GENERAL_FALLBACK;
    return { intent: "일반문의" };
  }

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
      const [games, displayName] = await Promise.all([
        fetchUserGames(params.userId),
        fetchUserDisplayName(params.userId),
      ]);
      yield* runUserAnalysisAgent({
        userMessage: params.userMessage,
        games,
        displayName,
        history: priorHistory,
      });
      return { intent };
    }
    default: {
      yield generalReply?.trim() || GENERAL_FALLBACK;
      return { intent: "일반문의" };
    }
  }
}
