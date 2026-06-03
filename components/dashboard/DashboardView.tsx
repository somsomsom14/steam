"use client";

import {
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { FIGMA } from "@/lib/dashboard/constants";
import { formatHours, formatPercent } from "@/lib/dashboard/format";
import type { DashboardAnalysis } from "@/lib/dashboard/types";
import { AnalysisSummaryCard } from "./AnalysisSummaryCard";
import { DashboardResyncButton } from "./DashboardResyncButton";
import { DashboardSidebar } from "./DashboardSidebar";
import { ProfileAvatar } from "./ProfileAvatar";
import { FigmaHorizontalBars } from "./FigmaHorizontalBars";
import { GlassPreferenceBars } from "./GlassPreferenceBars";
import "./dashboard.css";

const ANIMATION_MS = 1400;
const RADAR_LABEL_OFFSET = 22;

function RadarAxisTick(props: {
  x?: string | number;
  y?: string | number;
  payload?: { value: string };
  cx?: string | number;
  cy?: string | number;
}) {
  const x = Number(props.x ?? 0);
  const y = Number(props.y ?? 0);
  const cx = Number(props.cx ?? 0);
  const cy = Number(props.cy ?? 0);
  const dx = x - cx;
  const dy = y - cy;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ox = (dx / len) * RADAR_LABEL_OFFSET;
  const oy = (dy / len) * RADAR_LABEL_OFFSET;

  return (
    <text
      x={x + ox}
      y={y + oy}
      textAnchor="middle"
      dominantBaseline="central"
      fill={FIGMA.textMuted}
      fontSize={15}
    >
      {props.payload?.value ?? ""}
    </text>
  );
}

type Props = {
  displayName: string;
  avatarUrl: string;
  steamId: string;
  analysis: DashboardAnalysis;
  fetchError?: string | null;
};

function getEmptyStateMessage(
  analysis: DashboardAnalysis,
  fetchError?: string | null
): { title: string; description: string; action?: { href: string; label: string } } {
  if (fetchError) {
    return {
      title: "게임 데이터를 불러오지 못했습니다",
      description:
        "Supabase 연결 또는 테이블 설정을 확인한 뒤, 온보딩에서 Steam 동기화를 다시 시도해 주세요.",
      action: { href: "/onboarding", label: "Steam 다시 동기화" },
    };
  }

  const { libraryCount, zeroPlaytimeCount } = analysis.stats;

  if (libraryCount === 0) {
    return {
      title: "Steam 라이브러리가 아직 동기화되지 않았습니다",
      description:
        "온보딩에서 ‘분석하고 시작하기’를 눌러 게임 목록을 가져와 주세요. ‘나중에 하기’로 건너뛰면 대시보드에 데이터가 없습니다.",
      action: { href: "/onboarding", label: "Steam 동기화 하기" },
    };
  }

  if (zeroPlaytimeCount === libraryCount) {
    return {
      title: "보유 게임은 있지만 플레이 기록이 없습니다",
      description: `라이브러리 ${libraryCount}개가 저장되어 있으나, 플레이 시간이 0분인 게임만 있습니다. Steam 프로필·게임 상세를 공개한 뒤 다시 동기화해 주세요.`,
      action: { href: "/onboarding", label: "Steam 다시 동기화" },
    };
  }

  return {
    title: "분석할 플레이 데이터가 없습니다",
    description: `보유 ${libraryCount}개 중 플레이 기록이 있는 게임이 없습니다. Steam에서 실제로 플레이한 게임이 동기화되는지 확인해 주세요.`,
    action: { href: "/onboarding", label: "Steam 다시 동기화" },
  };
}

function DonutTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: { genre: string; percent: number; minutes: number } }[];
}) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="dashboard-chart-tooltip">
      <div>{d.genre}</div>
      <div>{formatPercent(d.percent)}</div>
      <div style={{ opacity: 0.7 }}>{formatHours(d.minutes)}</div>
    </div>
  );
}

export function DashboardView({
  displayName,
  avatarUrl,
  steamId,
  analysis,
  fetchError,
}: Props) {
  const hasCharts = analysis.stats.gameCount > 0;
  const emptyState = !hasCharts ? getEmptyStateMessage(analysis, fetchError) : null;

  const radarData = analysis.radar.map((r) => ({
    trait: r.trait,
    score: r.value,
    fullMark: 100,
  }));

  const genreData = analysis.genres.slice(0, 4).map((g, i) => ({
    ...g,
    fill: FIGMA.donut[i % FIGMA.donut.length],
  }));

  const topGenre = genreData[0];

  const topGamesForBars = analysis.topGames.map((g) => ({
    name: g.name.length > 22 ? `${g.name.slice(0, 20)}…` : g.name,
    fullName: g.name,
    hours: g.playtimeForeverHours,
    recent: g.playtime2WeeksHours,
  }));

  const maxBarHours = Math.max(
    ...topGamesForBars.flatMap((g) => [g.hours, g.recent]),
    1
  );

  const playPrefGlass = analysis.playPreference.map((p) => ({
    label: p.label === "Single Player" ? "Single Player" : "Multi Player",
    percent: p.percent,
  }));

  return (
    <div className="dashboard-shell">
      <DashboardSidebar activePath="/dashboard" />

      <div className="dashboard-right">
        <header className="dashboard-topbar">
          <a href="/" className="dashboard-mobile-logo">
            MI-TEAM
          </a>
          <div className="dashboard-topbar__bell-wrap">
            <span className="dashboard-topbar__bell-dot" />
            <button type="button" className="dashboard-topbar__bell" aria-label="알림">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z" />
              </svg>
            </button>
          </div>
          <a href="/profile" className="dashboard-topbar__profile" style={{ textDecoration: "none", cursor: "pointer" }}>
            <ProfileAvatar
              src={avatarUrl}
              alt=""
              className="dashboard-topbar__avatar"
            />
            <div className="dashboard-topbar__info">
              <div className="dashboard-topbar__name">{displayName}</div>
              <div className="dashboard-topbar__id">
                ID: <strong>{steamId.slice(-7)}</strong>
              </div>
              <svg
                className="dashboard-topbar__chevron"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M7 10l5 5 5-5H7z" />
              </svg>
            </div>
          </a>
        </header>

        <div className="dashboard-dark">
          <div className="dashboard-hero">
            <div className="dashboard-hero__profile">
              <ProfileAvatar
                src={avatarUrl}
                alt=""
                className="dashboard-hero__avatar"
              />
              <div>
                <p className="dashboard-hero__name">안녕하세요, {displayName}님</p>
                <p className="dashboard-hero__sub">
                  {hasCharts
                    ? "Steam 라이브러리 기반 플레이 분석 결과예요."
                    : "플레이 데이터를 불러오면 차트가 표시됩니다."}
                </p>
              </div>
            </div>
            <div className="dashboard-hero__stats">
              <div className="dashboard-stat-pill">
                <span className="dashboard-stat-pill__label">
                  {hasCharts ? "분석된 게임" : "보유 게임"}
                </span>
                <span className="dashboard-stat-pill__value">
                  {hasCharts
                    ? `${analysis.stats.gameCount}개`
                    : `${analysis.stats.libraryCount}개`}
                </span>
              </div>
              <div className="dashboard-stat-pill">
                <span className="dashboard-stat-pill__label">총 플레이 시간</span>
                <span className="dashboard-stat-pill__value">
                  {hasCharts
                    ? formatHours(analysis.stats.totalPlaytimeMinutes)
                    : "—"}
                </span>
              </div>
            </div>
          </div>

          {!hasCharts && emptyState ? (
            <div className="dashboard-empty dashboard-empty--inline">
              <p className="dashboard-empty__title">{emptyState.title}</p>
              <p className="dashboard-empty__desc">{emptyState.description}</p>
              <DashboardResyncButton label={emptyState.action?.label ?? "Steam 다시 동기화"} />
              {emptyState.action?.href === "/onboarding" && (
                <p className="dashboard-empty__hint">
                  또는{" "}
                  <a href="/onboarding" className="dashboard-empty__link">
                    온보딩 페이지
                  </a>
                  에서 설정할 수 있어요.
                </p>
              )}
            </div>
          ) : (
          <div className="dashboard-charts">
            {/* ① Steam DNA */}
            <section className="dashboard-panel dashboard-panel--d1 dashboard-charts__radar">
              <div className="dashboard-panel__heading">Steam DNA</div>
              <div className="radar-wrap">
                <ResponsiveContainer width="100%" height={520}>
                  <RadarChart
                    data={radarData}
                    cx="50%"
                    cy="50%"
                    outerRadius="65%"
                    margin={{ top: 56, right: 72, bottom: 56, left: 72 }}
                  >
                  <defs>
                    <linearGradient id="figmaRadarGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor={FIGMA.pink} stopOpacity={0.75} />
                      <stop offset="100%" stopColor="#818cf8" stopOpacity={0.35} />
                    </linearGradient>
                  </defs>
                  <PolarGrid gridType="polygon" />
                  <PolarAngleAxis
                    dataKey="trait"
                    tick={RadarAxisTick}
                    tickLine={false}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }}
                    tickCount={5}
                    axisLine={false}
                  />
                  <Radar
                    dataKey="score"
                    stroke={FIGMA.pink}
                    fill="url(#figmaRadarGrad)"
                    strokeWidth={2}
                    dot={{ fill: FIGMA.pink, r: 3 }}
                    isAnimationActive
                    animationDuration={ANIMATION_MS}
                    animationEasing="ease-out"
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const d = payload[0].payload as { trait: string; score: number };
                      return (
                        <div className="dashboard-chart-tooltip">
                          <div>{d.trait}</div>
                          <div style={{ color: FIGMA.green }}>{d.score} / 100</div>
                        </div>
                      );
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
              </div>
            </section>

            {/* ② Top Playtime — 2중 가로 막대 */}
            <section className="dashboard-panel dashboard-panel--d2 dashboard-charts__hbars">
              <div className="dashboard-panel__heading">Top Playtime Games</div>
              <FigmaHorizontalBars items={topGamesForBars} maxHours={maxBarHours} />
            </section>

            {/* ③④⑤ 하단 3열: Donut | Play Preference | AI Summary */}
            <div className="dashboard-charts__bottom">
              <section className="dashboard-panel dashboard-panel--d3 dashboard-charts__donut">
                <div className="dashboard-panel__heading">Genre Distribution</div>
                <div className="donut-layout">
                  <div className="donut-wrap">
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={genreData}
                          dataKey="minutes"
                          nameKey="genre"
                          cx="50%"
                          cy="50%"
                          innerRadius={82}
                          outerRadius={118}
                          paddingAngle={2}
                          strokeWidth={0}
                          isAnimationActive
                          animationDuration={ANIMATION_MS}
                          animationEasing="ease-out"
                        >
                          {genreData.map((entry) => (
                            <Cell key={entry.genre} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip content={<DonutTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    {topGenre && (
                      <div className="donut-center">
                        <span className="donut-center__pct">
                          {formatPercent(topGenre.percent)}
                        </span>
                        <span className="donut-center__label">{topGenre.genre}</span>
                      </div>
                    )}
                  </div>
                  <div className="donut-legend">
                    {genreData.map((g) => (
                      <div key={g.genre} className="donut-legend__item">
                        <span className="donut-legend__dot" style={{ background: g.fill }} />
                        <span>{g.genre}</span>
                        <span className="donut-legend__pct">{formatPercent(g.percent)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="dashboard-panel dashboard-panel--d4 dashboard-charts__pref">
                <div className="dashboard-panel__heading">Play Preference</div>
                <GlassPreferenceBars items={playPrefGlass} animationMs={ANIMATION_MS} />
              </section>

              <section className="dashboard-panel dashboard-panel--d5 dashboard-charts__summary">
                <AnalysisSummaryCard analysis={analysis} />
              </section>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
