import type { DashboardAnalysis } from "./types";
import { formatPercent } from "./format";

const TRAIT_SUMMARY: Record<string, string> = {
  협동: "협동 게임 선호도가 높습니다.",
  공포: "공포·호러 장르에 플레이 시간이 많이 쏠려 있습니다.",
  경쟁: "경쟁·PvP 위주의 플레이 성향이 뚜렷합니다.",
  생존: "생존·크래프팅 게임을 즐기는 플레이어입니다.",
  전술: "전략·베이스 빌딩 등 전술적 플레이를 선호합니다.",
  소셜: "파티·소셜 디덕션 게임을 자주 즐깁니다.",
};

export function buildAnalysisSummary(analysis: DashboardAnalysis): {
  headline: string;
  preferenceLine: string;
  recentIntro: string;
  recentClosing: string | null;
  recentItems: string[];
  hasRecent: boolean;
} {
  const topRadar = analysis.radar.find((r) => r.trait === analysis.topTrait);

  const headline =
    analysis.topTrait && topRadar && topRadar.rawMinutes > 0
      ? `당신은 ${TRAIT_SUMMARY[analysis.topTrait] ?? `${analysis.topTrait} 성향이 가장 두드러집니다.`}`
      : "아직 뚜렷한 플레이 성향이 잡히지 않았습니다.";

  const multiHigher = analysis.multiPercent >= analysis.singlePercent;
  const dominantPercent = multiHigher
    ? analysis.multiPercent
    : analysis.singlePercent;
  const modeLabel = multiHigher ? "멀티플레이" : "싱글플레이";

  const preferenceLine =
    dominantPercent > 0
      ? `전체 플레이 시간의 ${formatPercent(dominantPercent)}가 ${modeLabel} 게임에 집중되어 있습니다.`
      : "싱글·멀티 플레이 비율을 계산할 데이터가 부족합니다.";

  const hasRecent = analysis.recentGames.length > 0;

  return {
    headline,
    preferenceLine,
    recentIntro: hasRecent
      ? "최근 2주 동안"
      : "최근 2주 동안 플레이한 게임 기록이 없습니다.",
    recentClosing: hasRecent ? "위주로 플레이했습니다." : null,
    recentItems: analysis.recentGames.map((g) => g.name),
    hasRecent,
  };
}
