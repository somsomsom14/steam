import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { analyzeGames, parseUserGame } from "@/lib/dashboard/analytics";
import { resolveAvatarUrl, resolveDisplayName } from "@/lib/user-profile";
import { verifySession } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase";

const GAME_SELECT_FULL =
  "appid, game_name, genres, categories, tags, playtime_forever, playtime_2weeks";

const GAME_SELECT_FALLBACK =
  "appid, game_name, genres, categories, playtime_forever, playtime_2weeks";

async function fetchUserGames(userId: string) {
  const supabase = createSupabaseServerClient();

  const full = await supabase
    .from("user_games")
    .select(GAME_SELECT_FULL)
    .eq("user_id", userId);

  if (!full.error) {
    return { games: full.data ?? [], fetchError: null as string | null };
  }

  console.error("[dashboard] user_games select (full):", full.error.message);

  const fallback = await supabase
    .from("user_games")
    .select(GAME_SELECT_FALLBACK)
    .eq("user_id", userId);

  if (fallback.error) {
    console.error("[dashboard] user_games select (fallback):", fallback.error.message);
    return { games: [], fetchError: fallback.error.message };
  }

  return { games: fallback.data ?? [], fetchError: null as string | null };
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;

  if (!token) redirect("/");

  const session = await verifySession(token);
  if (!session) redirect("/");

  const supabase = createSupabaseServerClient();

  const [{ data: user }, { games, fetchError }] = await Promise.all([
    supabase
      .from("users")
      .select("steam_nickname, steam_avatar_url, app_nickname, app_avatar_url")
      .eq("id", session.userId)
      .single(),
    fetchUserGames(session.userId),
  ]);

  const parsed = games.map(parseUserGame);
  const analysis = analyzeGames(parsed);

  const displayName = user ? resolveDisplayName(user) : "게이머";
  const avatarUrl = user ? resolveAvatarUrl(user) : "";

  return (
    <DashboardView
      displayName={displayName}
      avatarUrl={avatarUrl}
      analysis={analysis}
      fetchError={fetchError}
    />
  );
}
