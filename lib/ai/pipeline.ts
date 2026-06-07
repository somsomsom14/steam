import { runOrchestrator } from "./orchestrator";
import { fetchRoomsForRecommend, fetchUserDisplayName, fetchUserGames } from "./data";
import { runGameRecommendAgent } from "./agents/game-recommend";
import { runRoomRecommendAgent } from "./agents/room-recommend";
import { runUserAnalysisAgent } from "./agents/user-analysis";
import { needsSteamSyncForAnalysis, STEAM_SYNC_REQUIRED_MESSAGE } from "./analysis-input";
import {
  isSteamDataQuestion,
  resolveAnalysisMode,
  tryAnswerSteamDataQuestion,
} from "./steam-data-query";
import type { ChatHistoryMessage, ChatIntent } from "./types";

export type PipelineMeta = {
  intent: ChatIntent;
};

const GENERAL_FALLBACK =
  "MI-TEAM AI 상담소입니다. 게임 추천, 방 추천, Steam 성향 분석, 서비스 이용 문의를 도와드릴 수 있어요.";

type PipelineHandler =
  | "Orchestrator(일반문의)"
  | "GameRecommendAgent"
  | "RoomRecommendAgent"
  | "SteamSyncRequired"
  | "SteamDataDirect"
  | "UserAnalysisAgent(full)"
  | "UserAnalysisAgent(qa)";

function logPipelineRoute(params: {
  message: string;
  orchestratorIntent: ChatIntent;
  analysisMode: string | null;
  steamDataQuestion: boolean;
  analysisRoute: string;
  resolvedIntent: ChatIntent;
  handler: PipelineHandler;
}) {
  const preview =
    params.message.length > 80 ? `${params.message.slice(0, 80)}…` : params.message;

  console.log("[ai-pipeline] ─────────────────────────────────────");
  console.log(`[ai-pipeline] message: ${JSON.stringify(preview)}`);
  console.log(`[ai-pipeline] orchestrator intent: ${params.orchestratorIntent}`);
  console.log(`[ai-pipeline] orchestrator mode: ${params.analysisMode ?? "—"}`);
  console.log(`[ai-pipeline] steamDataQuestion: ${params.steamDataQuestion}`);
  if (params.steamDataQuestion && params.orchestratorIntent !== "성향분석") {
    console.log(
      `[ai-pipeline] ⚠ intent override: ${params.orchestratorIntent} → ${params.resolvedIntent}`
    );
  }
  console.log(`[ai-pipeline] analysisRoute: ${params.analysisRoute}`);
  console.log(`[ai-pipeline] resolvedIntent: ${params.resolvedIntent}`);
  console.log(`[ai-pipeline] handler: ${params.handler}`);
  console.log("[ai-pipeline] ─────────────────────────────────────");
}

/** Orchestrator(Gemini) → 전문 Agent 또는 일반 문의 직접 응답 */
export async function* runChatPipeline(params: {
  userId: string;
  userMessage: string;
  history: ChatHistoryMessage[];
}): AsyncGenerator<string, PipelineMeta> {
  const { intent, generalReply, analysisMode } = await runOrchestrator(params.userMessage, params.history);
  const priorHistory = params.history;

  const steamDataQuestion = isSteamDataQuestion(params.userMessage);
  const analysisRoute = resolveAnalysisMode(params.userMessage, analysisMode);
  const resolvedIntent: ChatIntent = steamDataQuestion ? "성향분석" : intent;

  const logBase = {
    message: params.userMessage,
    orchestratorIntent: intent,
    analysisMode,
    steamDataQuestion,
    analysisRoute,
    resolvedIntent,
  };

  if (intent === "일반문의" && !steamDataQuestion) {
    logPipelineRoute({ ...logBase, handler: "Orchestrator(일반문의)" });
    yield generalReply?.trim() || GENERAL_FALLBACK;
    return { intent: "일반문의" };
  }

  /** Steam DB 질문은 Orchestrator 분류와 무관하게 데이터 경로 */

  switch (resolvedIntent) {
    case "게임추천": {
      logPipelineRoute({ ...logBase, handler: "GameRecommendAgent" });
      const games = await fetchUserGames(params.userId);
      yield* runGameRecommendAgent({
        userMessage: params.userMessage,
        games,
        history: priorHistory,
      });
      return { intent: resolvedIntent };
    }
    case "방추천": {
      logPipelineRoute({ ...logBase, handler: "RoomRecommendAgent" });
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
      return { intent: resolvedIntent };
    }
    case "성향분석": {
      const [games, displayName] = await Promise.all([
        fetchUserGames(params.userId),
        fetchUserDisplayName(params.userId),
      ]);

      if (needsSteamSyncForAnalysis(games)) {
        logPipelineRoute({ ...logBase, handler: "SteamSyncRequired" });
        yield STEAM_SYNC_REQUIRED_MESSAGE;
        return { intent: resolvedIntent };
      }

      if (analysisRoute === "qa") {
        const directAnswer = tryAnswerSteamDataQuestion(params.userMessage, games);
        if (directAnswer) {
          logPipelineRoute({ ...logBase, handler: "SteamDataDirect" });
          yield directAnswer;
          return { intent: resolvedIntent };
        }
      }

      logPipelineRoute({
        ...logBase,
        handler: analysisRoute === "full" ? "UserAnalysisAgent(full)" : "UserAnalysisAgent(qa)",
      });
      yield* runUserAnalysisAgent({
        userMessage: params.userMessage,
        games,
        displayName,
        history: priorHistory,
        fullReport: analysisRoute === "full",
      });
      return { intent: resolvedIntent };
    }
    default: {
      logPipelineRoute({ ...logBase, handler: "Orchestrator(일반문의)" });
      yield generalReply?.trim() || GENERAL_FALLBACK;
      return { intent: "일반문의" };
    }
  }
}
