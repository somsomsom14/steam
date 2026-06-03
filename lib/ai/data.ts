import { createSupabaseServerClient } from "@/lib/supabase";
import type { RoomForRecommend, UserGameRecord } from "./types";

export async function fetchUserGames(userId: string): Promise<UserGameRecord[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("user_games")
    .select("appid, game_name, genres, categories, tags, playtime_forever")
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  return (data ?? []) as UserGameRecord[];
}

export async function fetchRoomsForRecommend(): Promise<RoomForRecommend[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("rooms")
    .select("id, title, subtitle, game_name, tags, room_members(count)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => {
    const members = r.room_members as { count: number }[] | { count: number } | null;
    const count = Array.isArray(members) ? members[0]?.count ?? 0 : members?.count ?? 0;
    const tags = Array.isArray(r.tags) ? (r.tags as string[]) : [];
    return {
      id: r.id as string,
      title: r.title as string,
      subtitle: (r.subtitle as string | null) ?? null,
      game_name: r.game_name as string,
      tags,
      member_count: count,
    };
  });
}
