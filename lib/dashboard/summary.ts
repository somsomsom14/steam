import type { DashboardAnalysis } from "./types";
import { formatHours } from "./format";

/** Steam DNA 상위 성향 → 감성 한 줄 */
const TRAIT_PERSONALITY: Record<string, string> = {
  협동: "팀과 함께할 때 가장 빛나는 플레이어예요. 🤝",
  공포: "심장이 쫄깃해지는 순간을 즐기는 타입이에요. 👻",
  경쟁: "당신은 이기는 것에 진심인 플레이어입니다. 🏆",
  생존: "끝까지 살아남는 데 몰입하는 서바이벌러예요. 🏕️",
  전술: "한 수 앞을 읽는 전략가 스타일이에요. 🧠",
  소셜: "사람들과 어울리며 게임하는 걸 좋아해요. 🎭",
};

/** 보유 게임 수 구간별 훅 */
function libraryTierMessage(count: number): string | null {
  if (count <= 0) return null;
  const n = count.toLocaleString("ko-KR");
  if (count <= 20) return `${n}개의 게임, 아직 채워가는 중이에요!`;
  if (count <= 50) return `${n}개의 게임, 다양한 장르를 즐기는 플레이어네요!`;
  if (count <= 100) return `${n}개의 게임, 게임에 진심인 플레이어네요!`;
  if (count <= 200) return `${n}개의 게임, 컬렉터 수준이에요!`;
  return `${n}개의 게임, 이건 박물관인가요..? 🏛️`;
}

function formatHoursCasual(minutes: number): string {
  const h = Math.round(minutes / 60);
  return h >= 1 ? `${h.toLocaleString("ko-KR")}시간` : `${minutes}분`;
}

export type AnalysisSummary = {
  headline: string | null;
  libraryLine: string | null;
  totalPlayLine: string | null;
  topTraitLine: { trait: string; percent: number } | null;
  topGenreLine: { genre: string; percent: number } | null;
  topGameLine: { name: string; hoursLabel: string } | null;
};

export function buildAnalysisSummary(analysis: DashboardAnalysis): AnalysisSummary {
  const { stats, topGames } = analysis;
  const topRadar = analysis.radar.find((r) => r.trait === analysis.topTrait);
  const topRadarByMinutes = [...analysis.radar].sort((a, b) => b.rawMinutes - a.rawMinutes)[0];
  const topGenre = analysis.genres[0];

  const headline =
    analysis.topTrait && topRadar && topRadar.rawMinutes > 0
      ? TRAIT_PERSONALITY[analysis.topTrait] ??
        `${analysis.topTrait} 성향이 당신을 가장 잘 설명해요.`
      : null;

  const libraryLine = libraryTierMessage(stats.libraryCount);

  const totalPlayLine =
    stats.totalPlaytimeMinutes > 0
      ? `총 ${formatHours(stats.totalPlaytimeMinutes)}을 게임과 함께했어요.`
      : null;

  const topTraitLine =
    topRadarByMinutes && topRadarByMinutes.rawMinutes > 0
      ? {
          trait: topRadarByMinutes.trait,
          percent: Math.round(topRadarByMinutes.value),
        }
      : null;

  const topGenreLine =
    topGenre && topGenre.minutes > 0 && topGenre.genre !== "Unknown"
      ? {
          genre: topGenre.genre,
          percent: Math.round(topGenre.percent),
        }
      : null;

  const top = topGames[0];
  const topGameLine =
    top && top.playtimeForeverMinutes > 0
      ? {
          name: top.name,
          hoursLabel: formatHoursCasual(top.playtimeForeverMinutes),
        }
      : null;

  return {
    headline,
    libraryLine,
    totalPlayLine,
    topTraitLine,
    topGenreLine,
    topGameLine,
  };
}
