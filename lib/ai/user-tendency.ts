import type { TagTendency, UserGameRecord } from "./types";

function normalizeJsonArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

/** 태그별 플레이타임 합산 후 상위 N개 */
export function aggregateTagPlaytime(games: UserGameRecord[], topN = 10): TagTendency[] {
  const map = new Map<string, number>();

  for (const game of games) {
    const minutes = Number(game.playtime_forever) || 0;
    if (minutes <= 0) continue;
    for (const tag of normalizeJsonArray(game.tags)) {
      const key = tag.trim();
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + minutes);
    }
  }

  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([tag, minutes]) => ({
      tag,
      minutes,
      hours: Math.round((minutes / 60) * 10) / 10,
    }));
}

export function aggregateGenrePlaytime(games: UserGameRecord[], topN = 8): TagTendency[] {
  const map = new Map<string, number>();

  for (const game of games) {
    const minutes = Number(game.playtime_forever) || 0;
    if (minutes <= 0) continue;
    for (const genre of normalizeJsonArray(game.genres)) {
      const key = genre.trim();
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + minutes);
    }
  }

  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([tag, minutes]) => ({
      tag,
      minutes,
      hours: Math.round((minutes / 60) * 10) / 10,
    }));
}

export function formatTendencyForPrompt(tendencies: TagTendency[]): string {
  if (tendencies.length === 0) {
    return "분석 가능한 플레이 기록이 없습니다. (playtime이 0인 게임만 있거나 동기화가 필요할 수 있습니다)";
  }
  return tendencies
    .map((t, i) => `${i + 1}. ${t.tag} — 총 ${t.hours}시간 (${t.minutes}분)`)
    .join("\n");
}

export function summarizeTopGames(games: UserGameRecord[], limit = 8): string {
  const sorted = [...games]
    .filter((g) => Number(g.playtime_forever) > 0)
    .sort((a, b) => Number(b.playtime_forever) - Number(a.playtime_forever))
    .slice(0, limit);

  if (sorted.length === 0) return "플레이 타임이 기록된 게임 없음";

  return sorted
    .map((g) => {
      const h = Math.round((Number(g.playtime_forever) / 60) * 10) / 10;
      return `- ${g.game_name ?? `App ${g.appid}`}: ${h}시간`;
    })
    .join("\n");
}
