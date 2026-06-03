import {
  MULTI_CATEGORIES,
  SINGLE_CATEGORY,
  TRAIT_TAG_MAP,
} from "./constants";
import { minutesToHours } from "./format";
import type {
  DashboardAnalysis,
  GenreSlice,
  PlayPreference,
  RadarPoint,
  TopGameBar,
  UserGameRow,
} from "./types";

function normalizeJsonArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

export function parseUserGame(row: {
  appid: number;
  game_name: string | null;
  genres: unknown;
  categories: unknown;
  tags?: unknown;
  playtime_forever: number | string | null;
  playtime_2weeks: number | string | null;
}): UserGameRow {
  return {
    appid: row.appid,
    game_name: row.game_name,
    genres: normalizeJsonArray(row.genres),
    categories: normalizeJsonArray(row.categories),
    tags: normalizeJsonArray(row.tags),
    playtime_forever: Number(row.playtime_forever) || 0,
    playtime_2weeks: Number(row.playtime_2weeks) || 0,
  };
}

export function filterAnalyzableGames(games: UserGameRow[]): UserGameRow[] {
  return games.filter((g) => g.playtime_forever > 0);
}

function matchesTag(gameTags: string[], candidates: string[]): boolean {
  const normalizedTags = gameTags.map((t) => t.toLowerCase());
  return candidates.some((candidate) => {
    const c = candidate.toLowerCase();
    return normalizedTags.some((t) => t === c || t.includes(c));
  });
}

function matchesCategory(categories: string[], candidates: string[]): boolean {
  const normalized = categories.map((c) => c.toLowerCase());
  return candidates.some((candidate) => {
    const c = candidate.toLowerCase();
    return normalized.some((cat) => cat === c || cat.includes(c));
  });
}

function computeRadar(games: UserGameRow[]): RadarPoint[] {
  const raw: Record<string, number> = {};
  for (const trait of Object.keys(TRAIT_TAG_MAP)) raw[trait] = 0;

  for (const game of games) {
    for (const [trait, tags] of Object.entries(TRAIT_TAG_MAP)) {
      if (matchesTag(game.tags, tags)) {
        raw[trait] += game.playtime_forever;
      }
    }
  }

  const max = Math.max(...Object.values(raw), 1);
  return Object.entries(raw).map(([trait, minutes]) => ({
    trait,
    value: Math.round((minutes / max) * 100),
    rawMinutes: minutes,
  }));
}

function computeGenres(games: UserGameRow[]): GenreSlice[] {
  const totals: Record<string, number> = {};
  for (const game of games) {
    const genres = game.genres.length > 0 ? game.genres : ["Unknown"];
    for (const genre of genres) {
      totals[genre] = (totals[genre] ?? 0) + game.playtime_forever;
    }
  }

  const sum = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(totals)
    .map(([genre, minutes]) => ({
      genre,
      minutes,
      percent: (minutes / sum) * 100,
    }))
    .sort((a, b) => b.minutes - a.minutes);
}

function computePlayPreference(games: UserGameRow[]): PlayPreference[] {
  let singleMinutes = 0;
  let multiMinutes = 0;

  for (const game of games) {
    const isMulti = matchesCategory(game.categories, MULTI_CATEGORIES);
    const isSingle = matchesCategory(game.categories, [SINGLE_CATEGORY]);

    if (isMulti) {
      multiMinutes += game.playtime_forever;
    } else if (isSingle) {
      singleMinutes += game.playtime_forever;
    }
  }

  const total = singleMinutes + multiMinutes || 1;
  return [
    {
      label: "Single Player",
      minutes: singleMinutes,
      percent: (singleMinutes / total) * 100,
    },
    {
      label: "Multi Player",
      minutes: multiMinutes,
      percent: (multiMinutes / total) * 100,
    },
  ];
}

function computeTopGames(games: UserGameRow[]): TopGameBar[] {
  return [...games]
    .sort((a, b) => b.playtime_forever - a.playtime_forever)
    .slice(0, 5)
    .map((g) => ({
      appid: g.appid,
      name: g.game_name ?? `App ${g.appid}`,
      playtimeForeverMinutes: g.playtime_forever,
      playtime2WeeksMinutes: g.playtime_2weeks,
      playtimeForeverHours: minutesToHours(g.playtime_forever),
      playtime2WeeksHours: minutesToHours(g.playtime_2weeks),
    }));
}

function computeRecentGames(games: UserGameRow[]) {
  return [...games]
    .filter((g) => g.playtime_2weeks > 0)
    .sort((a, b) => b.playtime_2weeks - a.playtime_2weeks)
    .slice(0, 3)
    .map((g) => ({
      name: g.game_name ?? `App ${g.appid}`,
      playtime2WeeksHours: minutesToHours(g.playtime_2weeks),
    }));
}

export function analyzeGames(games: UserGameRow[]): DashboardAnalysis {
  const libraryCount = games.length;
  const analyzable = filterAnalyzableGames(games);
  const zeroPlaytimeCount = libraryCount - analyzable.length;
  const totalPlaytimeMinutes = analyzable.reduce(
    (sum, g) => sum + g.playtime_forever,
    0
  );

  const radar = computeRadar(analyzable);
  const genres = computeGenres(analyzable);
  const playPreference = computePlayPreference(analyzable);
  const topGames = computeTopGames(analyzable);
  const recentGames = computeRecentGames(analyzable);

  const topTrait =
    [...radar].sort((a, b) => b.rawMinutes - a.rawMinutes)[0]?.trait ?? null;

  const multi = playPreference.find((p) => p.label === "Multi Player");
  const single = playPreference.find((p) => p.label === "Single Player");

  return {
    stats: {
      gameCount: analyzable.length,
      libraryCount,
      zeroPlaytimeCount,
      totalPlaytimeMinutes,
      totalPlaytimeHours: minutesToHours(totalPlaytimeMinutes),
    },
    radar,
    genres,
    playPreference,
    topGames,
    recentGames,
    topTrait,
    multiPercent: multi?.percent ?? 0,
    singlePercent: single?.percent ?? 0,
  };
}
