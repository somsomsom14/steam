"use client";

import { useState } from "react";
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
      fill="rgba(255, 255, 255, 0.9)"
      fontSize={17}
      fontWeight={600}
    >
      {props.payload?.value ?? ""}
    </text>
  );
}

type Props = {
  displayName: string;
  avatarUrl: string;
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
      description: "",
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

type GenreChartItem = {
  genre: string;
  minutes: number;
  percent: number;
  fill: string;
};

export function DashboardView({
  displayName,
  avatarUrl,
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

  const genreData: GenreChartItem[] = analysis.genres.slice(0, 4).map((g, i) => ({
    ...g,
    fill: FIGMA.donut[i % FIGMA.donut.length],
  }));

  const [selectedGenreIndex, setSelectedGenreIndex] = useState(0);
  const selectedGenre = genreData[selectedGenreIndex] ?? genreData[0];

  const topGamesForBars = analysis.topGames.map((g) => ({
    name: g.name,
    fullName: g.name,
    hours: g.playtimeForeverHours,
    recent: g.playtime2WeeksHours,
  }));

  const maxBarHours = Math.max(
    ...topGamesForBars.flatMap((g) => [g.hours, g.recent]),
    1
  );

  const playPrefGlass = analysis.playPreference.map((p) => ({
    label: p.label === "Single Player" ? "Single Play" : "Multi Play",
    percent: p.percent,
  }));

  return (
    <div className="dashboard-shell">
      <DashboardSidebar activePath="/dashboard" />

      <div className="dashboard-right">
        <header className="dashboard-topbar">
          <a href="/dashboard" className="dashboard-mobile-logo">
            MI-TEAM
          </a>
          <a href="/profile" className="dashboard-topbar__profile" style={{ textDecoration: "none", cursor: "pointer" }}>
            <ProfileAvatar
              src={avatarUrl}
              alt=""
              className="dashboard-topbar__avatar"
            />
            <div className="dashboard-topbar__info">
              <div className="dashboard-topbar__name">{displayName}</div>
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
              {emptyState.description ? (
                <p className="dashboard-empty__desc">{emptyState.description}</p>
              ) : null}
              <DashboardResyncButton label={emptyState.action?.label ?? "Steam 다시 동기화"} />
            </div>
          ) : (
          <div className="dashboard-charts">
            {/* ① 상단 좌: Genre Distribution */}
            <section className="dashboard-panel dashboard-panel--d1 dashboard-charts__donut">
              <div className="dashboard-panel__heading">Game Types</div>
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
                        stroke="#ffffff"
                        isAnimationActive
                        animationDuration={ANIMATION_MS}
                        animationEasing="ease-out"
                        style={{ cursor: "pointer" }}
                        onClick={(_, index) => {
                          if (typeof index === "number") setSelectedGenreIndex(index);
                        }}
                      >
                        {genreData.map((entry, index) => (
                          <Cell
                            key={entry.genre}
                            fill={entry.fill}
                            stroke={selectedGenreIndex === index ? "#ffffff" : "transparent"}
                            strokeWidth={selectedGenreIndex === index ? 2 : 0}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  {selectedGenre && (
                    <div className="donut-center">
                      <span className="donut-center__pct">
                        {formatPercent(selectedGenre.percent)}
                      </span>
                      <span className="donut-center__label">{selectedGenre.genre}</span>
                      <span className="donut-center__time">
                        {formatHours(selectedGenre.minutes)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="donut-legend">
                  {genreData.map((g, index) => (
                    <button
                      key={g.genre}
                      type="button"
                      className={`donut-legend__item${selectedGenreIndex === index ? " is-active" : ""}`}
                      onClick={() => setSelectedGenreIndex(index)}
                    >
                      <span className="donut-legend__dot" style={{ background: g.fill }} />
                      <span>{g.genre}</span>
                      <span className="donut-legend__pct">{formatPercent(g.percent)}</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* ② 상단 우: Top Playtime */}
            <section className="dashboard-panel dashboard-panel--d2 dashboard-charts__hbars">
              <div className="dashboard-panel__heading">Top Playtime Games</div>
              <FigmaHorizontalBars items={topGamesForBars} maxHours={maxBarHours} />
            </section>

            {/* ③④⑤ 하단: Steam DNA | Play Preference | AI Summary */}
            <div className="dashboard-charts__bottom">
              <section className="dashboard-panel dashboard-panel--d3 dashboard-charts__radar">
                <div className="dashboard-panel__heading">Play Style</div>
                <div className="radar-wrap">
                  <ResponsiveContainer width="100%" height={380}>
                    <RadarChart
                      data={radarData}
                      cx="50%"
                      cy="50%"
                      outerRadius="68%"
                      margin={{ top: 32, right: 40, bottom: 32, left: 40 }}
                    >
                    <defs>
                      <linearGradient id="figmaRadarGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={FIGMA.pink} stopOpacity={0.75} />
                        <stop offset="100%" stopColor="#818cf8" stopOpacity={0.35} />
                      </linearGradient>
                    </defs>
                    <PolarGrid
                      gridType="polygon"
                      stroke="rgba(255, 255, 255, 0.28)"
                      strokeWidth={1.25}
                    />
                    <PolarAngleAxis
                      dataKey="trait"
                      tick={RadarAxisTick}
                      tickLine={false}
                    />
                    <PolarRadiusAxis
                      angle={90}
                      domain={[0, 100]}
                      tick={{ fill: "rgba(255, 255, 255, 0.62)", fontSize: 13, fontWeight: 500 }}
                      tickCount={5}
                      axisLine={false}
                    />
                    <Radar
                      dataKey="score"
                      stroke={FIGMA.pink}
                      fill="url(#figmaRadarGrad)"
                      strokeWidth={2.5}
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
