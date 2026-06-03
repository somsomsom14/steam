import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/session";
import { resolveAvatarUrl, resolveDisplayName } from "@/lib/user-profile";
import { createSupabaseServerClient } from "@/lib/supabase";
import { RoomsClient } from "./RoomsClient";

export default async function RoomsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) redirect("/");
  const session = await verifySession(token);
  if (!session) redirect("/");

  const supabase = createSupabaseServerClient();

  const [{ data: user }, { data: initialRooms }] = await Promise.all([
    supabase.from("users").select("app_nickname, steam_nickname, app_avatar_url, steam_avatar_url").eq("id", session.userId).single(),
    supabase.from("rooms").select(`id, title, subtitle, game_name, game_appid, game_thumbnail, host_id, tags, created_at, host:users!host_id(app_nickname, steam_nickname, app_avatar_url, steam_avatar_url), room_members(count)`).order("created_at", { ascending: false }),
  ]);

  const displayName = user ? resolveDisplayName(user) : "게이머";
  const avatarUrl = user ? resolveAvatarUrl(user) : "";

  return <RoomsClient initialRooms={initialRooms ?? []} displayName={displayName} avatarUrl={avatarUrl} steamId={session.steamId} />;
}
