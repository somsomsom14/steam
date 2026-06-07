import type { RoomRecommendItem } from "./types";

export const ROOM_RECS_MARKER = "\n---ROOM_RECS---\n";

export function serializeRoomRecommendMessage(intro: string, rooms: RoomRecommendItem[]): string {
  return `${intro.trim()}${ROOM_RECS_MARKER}${JSON.stringify({ rooms })}`;
}

export function parseRoomRecommendPayload(content: string): {
  text: string;
  rooms: RoomRecommendItem[] | null;
} {
  const idx = content.indexOf(ROOM_RECS_MARKER);
  if (idx === -1) return { text: content, rooms: null };

  const text = content.slice(0, idx).trim();
  try {
    const parsed = JSON.parse(content.slice(idx + ROOM_RECS_MARKER.length)) as {
      rooms?: RoomRecommendItem[];
    };
    return { text, rooms: parsed.rooms ?? null };
  } catch {
    return { text: content, rooms: null };
  }
}
