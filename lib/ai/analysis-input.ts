import { analyzeGames, filterAnalyzableGames, parseUserGame } from "@/lib/dashboard/analytics";
import { formatHours } from "@/lib/dashboard/format";
import { buildAnalysisSummary } from "@/lib/dashboard/summary";
import type { DashboardAnalysis } from "@/lib/dashboard/types";
import type { UserGameRecord } from "./types";

const PLAY_STYLE_TRAITS = ["협동", "소셜", "전술", "경쟁", "공포"] as const;

export const STEAM_SYNC_REQUIRED_MESSAGE = `Steam 플레이 데이터가 아직 없어서 성향 분석을 진행할 수 없어요.

Steam 프로필 → 프로필 편집 → 개인 정보 설정 → 게임 세부 정보: 공개

공개로 변경한 뒤 대시보드에서 「Steam 다시 동기화」를 진행해 주세요.

동기화가 끝난 뒤 다시 성향 분석을 요청해 주시면 돼요.`;

/** 라이브러리 없음 또는 플레이 기록(playtime > 0) 없음 */
export function needsSteamSyncForAnalysis(games: UserGameRecord[]): boolean {
  if (games.length === 0) return true;

  const rows = games.map(parseUserGame);
  if (rows.length === 0) return true;

  const analyzable = filterAnalyzableGames(rows);
  if (analyzable.length === 0) return true;

  const analysis = analyzeGames(rows);
  return analysis.stats.libraryCount === 0 || analysis.stats.gameCount === 0;
}

export type AnalysisAgentInput = {
  user_name: string;
  /** DB 보유 게임 수(플레이 0 포함) */
  total_games: number;
  total_playtime: string;
  /** store_price_krw 합계(원). 미저장·무료 제외 없이 NULL은 0 처리 */
  total_library_value_krw: number;
  genre_distribution: Record<string, string>;
  play_style_graph: Record<string, number>;
  multi_play_ratio: number;
  single_play_ratio: number;
  recent_2weeks_games: string[];
  top_played_games: { name: string; hours: string }[];
  most_played_game: { name: string; hours: string } | null;
  least_played_game: { name: string; hours: string } | null;
  play_style_headline: string | null;
};

function formatHoursCasual(minutes: number): string {
  const h = Math.round(minutes / 60);
  return h >= 1 ? `${h.toLocaleString("ko-KR")}시간` : `${minutes}분`;
}

function sumLibraryValueKrw(games: UserGameRecord[]): number {
  return games.reduce((sum, g) => {
    const price = g.store_price_krw;
    if (price == null || price === "") return sum;
    return sum + (Number(price) || 0);
  }, 0);
}

function resolveLeastPlayed(analysis: DashboardAnalysis): { name: string; hours: string } | null {
  if (analysis.leastPlayed && analysis.leastPlayed.playtimeForeverMinutes > 0) {
    return {
      name: analysis.leastPlayed.name,
      hours: formatHoursCasual(analysis.leastPlayed.playtimeForeverMinutes),
    };
  }
  return null;
}

function resolveLeastPlayedFromGames(
  games: ReturnType<typeof parseUserGame>[],
  topAppid?: number
): { name: string; hours: string } | null {
  const played = games.filter((g) => g.playtime_forever > 0 && g.appid !== topAppid);
  if (!played.length) return null;

  const min = played.reduce((a, b) => (a.playtime_forever < b.playtime_forever ? a : b));
  return {
    name: min.game_name ?? `App ${min.appid}`,
    hours: formatHoursCasual(min.playtime_forever),
  };
}

export function buildAnalysisAgentInput(
  games: UserGameRecord[],
  userName: string
): AnalysisAgentInput {
  const rows = games.map(parseUserGame);
  const analysis = analyzeGames(rows);
  const summary = buildAnalysisSummary(analysis);

  const genre_distribution: Record<string, string> = {};
  for (const g of analysis.genres) {
    genre_distribution[g.genre] = `${Math.round(g.percent)}%`;
  }

  const play_style_graph: Record<string, number> = {};
  for (const trait of PLAY_STYLE_TRAITS) {
    play_style_graph[trait] = analysis.radar.find((r) => r.trait === trait)?.value ?? 0;
  }

  const top = analysis.topGames[0];
  const most_played_game =
    top && top.playtimeForeverMinutes > 0
      ? { name: top.name, hours: formatHoursCasual(top.playtimeForeverMinutes) }
      : null;

  const least_played_game =
    resolveLeastPlayed(analysis) ?? resolveLeastPlayedFromGames(rows, top?.appid);

  const top_played_games = analysis.topGames.slice(0, 5).map((g) => ({
    name: g.name,
    hours: formatHoursCasual(g.playtimeForeverMinutes),
  }));

  return {
    user_name: userName,
    total_games: analysis.stats.libraryCount,
    total_playtime: formatHours(analysis.stats.totalPlaytimeMinutes),
    total_library_value_krw: sumLibraryValueKrw(games),
    genre_distribution,
    play_style_graph,
    multi_play_ratio: Math.round(analysis.multiPercent),
    single_play_ratio: Math.round(analysis.singlePercent),
    recent_2weeks_games: analysis.recentGames.map((g) => g.name),
    top_played_games,
    most_played_game,
    least_played_game,
    play_style_headline: summary.headline,
  };
}
