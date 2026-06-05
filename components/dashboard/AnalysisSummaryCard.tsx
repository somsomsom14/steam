import Link from "next/link";
import { buildAnalysisSummary } from "@/lib/dashboard/summary";
import type { DashboardAnalysis } from "@/lib/dashboard/types";

type Props = {
  analysis: DashboardAnalysis;
};

export function AnalysisSummaryCard({ analysis }: Props) {
  const summary = buildAnalysisSummary(analysis);

  return (
    <div className="analysis-card">
      <div className="analysis-card__tag">플레이 스타일 요약</div>

      {summary.headline && (
        <p className="analysis-card__headline">{summary.headline}</p>
      )}

      {(summary.libraryLine || summary.totalPlayLine) && (
        <p className="analysis-card__line">
          {summary.libraryLine}
          {summary.libraryLine && summary.totalPlayLine && " "}
          {summary.totalPlayLine}
        </p>
      )}

      {summary.topTraitLine && (
        <p className="analysis-card__line">
          플레이 스타일 DNA에서{" "}
          <strong className="analysis-card__highlight">{summary.topTraitLine.trait}</strong>
          이 가장 높아요. ({summary.topTraitLine.percent}%)
        </p>
      )}

      {summary.topGenreLine && (
        <p className="analysis-card__line">
          장르는{" "}
          <strong className="analysis-card__highlight">{summary.topGenreLine.genre}</strong>
          타입을 가장 오래 즐겼어요. ({summary.topGenreLine.percent}%)
        </p>
      )}

      {summary.topGameLine && (
        <p className="analysis-card__line">
          최애 게임은 역시{" "}
          <strong className="analysis-card__highlight">{summary.topGameLine.name}</strong>,
          무려 {summary.topGameLine.hoursLabel}이나 플레이했네요.
        </p>
      )}

      <div className="analysis-card__actions">
        <Link href="/chat?autostart=analysis" className="analysis-card__btn analysis-card__btn--primary">
          상세 분석 보기
        </Link>
        <Link href="/rooms" className="analysis-card__btn analysis-card__btn--secondary">
          팀 찾으러 가기
        </Link>
      </div>
    </div>
  );
}
