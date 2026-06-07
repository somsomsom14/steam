import type { ChatHistoryMessage, GameRecommendItem, RoomRecommendItem, UserGameRecord } from "./types";
import { parseRoomRecommendPayload, ROOM_RECS_MARKER } from "./room-recommend-utils";

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
  rooms: RoomRecommendItem[] | null;
} {
  const gameIdx = content.indexOf(GAME_RECS_MARKER);
  const roomIdx = content.indexOf(ROOM_RECS_MARKER);

  if (gameIdx !== -1 && (roomIdx === -1 || gameIdx < roomIdx)) {
    const text = content.slice(0, gameIdx).trim();
    try {
      const parsed = JSON.parse(content.slice(gameIdx + GAME_RECS_MARKER.length)) as {
        games?: GameRecommendItem[];
      };
      return { text, games: parsed.games ?? null, rooms: null };
    } catch {
      return { text: content, games: null, rooms: null };
    }
  }

  if (roomIdx !== -1) {
    const { text, rooms } = parseRoomRecommendPayload(content);
    return { text, games: null, rooms };
  }

  return { text: content, games: null, rooms: null };
}

export function serializeGameRecommendMessage(intro: string, games: GameRecommendItem[]): string {
  return `${intro.trim()}${GAME_RECS_MARKER}${JSON.stringify({ games })}`;
}

export function isMoreRecommendRequest(message: string): boolean {
  return /^\[?더 추천받기\]?$|더 추천받기|다른 게임 추천|추천 더/.test(message.trim());
}

/** tendency = 성향 기반, preference = 사용자가 말한 조건 우선 */
export type GameRecommendMode = "tendency" | "preference";

const GENERIC_RECOMMEND_RE =
  /^(게임\s*)?추천(해\s*줘|해주세요|해\s*주세요|좀)?[.!?\s]*$|^(뭐|무슨)\s*게임\s*(할까|해볼까|좋을까|하지)[.!?\s]*$|^어떤\s*게임\s*(추천|할까)[.!?\s]*$|^게임\s*하나\s*추천[.!?\s]*$/i;

const PREFERENCE_HINT_RE =
  /공포|호러|horror|좀비|서바이벌|생존|협동|co-?op|쿱|멀티|친구|같이|함께|캐주얼|가벼운|가볍게|심플|인디|fps|슈팅|퍼즐|rpg|전략|시뮬|레이싱|스포츠|액션|모험|개방형|오픈\s*월드|스토리|난이도|무료|할인|신작|인기|긴장|스릴|분위기|밤에|혼자|싱글|솔로|경쟁|pvp|턴제|로그라이크|샌드박스|타이쿤|농사|경영|비주얼\s*노벨|도트|그래픽/i;

export function getGameRecommendMode(message: string): GameRecommendMode {
  const m = message.trim();
  if (!m || isMoreRecommendRequest(m)) return "tendency";
  if (GENERIC_RECOMMEND_RE.test(m)) return "tendency";
  if (PREFERENCE_HINT_RE.test(m)) return "preference";
  if (/추천/.test(m) && m.replace(/\s/g, "").length > 10) return "preference";
  return "tendency";
}

/** '더 추천받기' 등은 직전 사용자 조건/성향 모드를 이어받음 */
export function resolveGameRecommendMode(
  userMessage: string,
  history: ChatHistoryMessage[]
): GameRecommendMode {
  if (!isMoreRecommendRequest(userMessage)) {
    return getGameRecommendMode(userMessage);
  }
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role === "user" && !isMoreRecommendRequest(msg.content)) {
      return getGameRecommendMode(msg.content);
    }
  }
  return "tendency";
}
