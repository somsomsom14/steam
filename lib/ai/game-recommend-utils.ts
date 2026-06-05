import type { ChatHistoryMessage, GameRecommendItem, UserGameRecord } from "./types";

export const GAME_RECS_MARKER = "\n---GAME_RECS---\n";

export function steamHeaderImageUrl(appid: number): string {
  return `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`;
}

export function steamStoreUrl(appid: number): string {
  return `https://store.steampowered.com/app/${appid}`;
}

export function normalizeGameName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function getOwnedAppIds(games: UserGameRecord[]): Set<number> {
  return new Set(games.map((g) => g.appid));
}

export function getOwnedNames(games: UserGameRecord[]): Set<string> {
  const names = new Set<string>();
  for (const g of games) {
    if (g.game_name) names.add(normalizeGameName(g.game_name));
  }
  return names;
}

export function isOwnedGame(
  appid: number | null,
  name: string,
  ownedAppIds: Set<number>,
  ownedNames: Set<string>
): boolean {
  if (appid && ownedAppIds.has(appid)) return true;
  return ownedNames.has(normalizeGameName(name));
}

/** 이전 AI 메시지에 포함된 추천 appid 수집 */
export function collectPreviouslyRecommendedAppIds(history: ChatHistoryMessage[]): Set<number> {
  const ids = new Set<number>();
  for (const msg of history) {
    if (msg.role !== "assistant") continue;
    const { games } = splitAssistantContent(msg.content);
    if (!games) continue;
    for (const g of games) {
      if (g.appid) ids.add(g.appid);
    }
  }
  return ids;
}

export function splitAssistantContent(content: string): {
  text: string;
  games: GameRecommendItem[] | null;
} {
  const idx = content.indexOf(GAME_RECS_MARKER);
  if (idx === -1) return { text: content, games: null };

  const text = content.slice(0, idx).trim();
  try {
    const parsed = JSON.parse(content.slice(idx + GAME_RECS_MARKER.length)) as {
      games?: GameRecommendItem[];
    };
    return { text, games: parsed.games ?? null };
  } catch {
    return { text: content, games: null };
  }
}

export function serializeGameRecommendMessage(intro: string, games: GameRecommendItem[]): string {
  return `${intro.trim()}${GAME_RECS_MARKER}${JSON.stringify({ games })}`;
}

export function isMoreRecommendRequest(message: string): boolean {
  return /^\[?더 추천받기\]?$|더 추천받기|다른 게임 추천|추천 더/.test(message.trim());
}
