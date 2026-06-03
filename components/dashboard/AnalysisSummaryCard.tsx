import { buildAnalysisSummary } from "@/lib/dashboard/summary";
import type { DashboardAnalysis } from "@/lib/dashboard/types";

type Props = {
  analysis: DashboardAnalysis;
};

export function AnalysisSummaryCard({ analysis }: Props) {
  const summary = buildAnalysisSummary(analysis);

  return (
    <div className="analysis-card">
      <div className="analysis-card__tag">AI 분석 요약</div>
      <h3 className="analysis-card__title">플레이 스타일 요약</h3>
      <p className="analysis-card__headline">{summary.headline}</p>
      <p className="analysis-card__line">{summary.preferenceLine}</p>
      <p className="analysis-card__line">{summary.recentIntro}</p>
      {summary.hasRecent && (
        <>
          <ul className="analysis-card__list">
            {summary.recentItems.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
          {summary.recentClosing && (
            <p className="analysis-card__line">{summary.recentClosing}</p>
          )}
        </>
      )}
    </div>
  );
}
