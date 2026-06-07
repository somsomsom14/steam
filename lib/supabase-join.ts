export function unwrapJoin<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export type RoomHostSnippet = {
  app_nickname: string | null;
  steam_nickname: string | null;
  app_avatar_url: string | null;
  steam_avatar_url: string | null;
};

export type NormalizedRoomRow = {
  id: string;
  title: string;
  subtitle: string | null;
  game_name: string;
  game_appid: number;
  game_thumbnail: string | null;
  host_id: string;
  tags: string[];
  created_at: string;
  host: RoomHostSnippet | null;
  room_members: { count: number }[];
};

export function normalizeRoomRow(row: {
  id: string;
  title: string;
  subtitle: string | null;
  game_name: string;
  game_appid: number;
  game_thumbnail: string | null;
  host_id: string;
  tags: unknown;
  created_at: string;
  host: RoomHostSnippet | RoomHostSnippet[] | null;
  room_members: { count: number }[];
}): NormalizedRoomRow {
  return {
    ...row,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    host: unwrapJoin(row.host),
    room_members: row.room_members,
  };
}

export function normalizeRoomRows(
  rows: Parameters<typeof normalizeRoomRow>[0][]
): NormalizedRoomRow[] {
  return rows.map(normalizeRoomRow);
}
