import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/session";
import { resolveAvatarUrl, resolveDisplayName } from "@/lib/user-profile";
import { createSupabaseServerClient } from "@/lib/supabase";
import { RoomsClient } from "../RoomsClient";

const ROOM_SELECT = `
  id, title, subtitle, game_name, game_appid, game_thumbnail, host_id, tags, created_at,
  host:users!host_id(app_nickname, steam_nickname, app_avatar_url, steam_avatar_url),
  room_members(count)
`;

type PageProps = {
  searchParams: Promise<{ blockedAppid?: string; blockedGame?: string }>;
};

export default async function MyRoomsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) redirect("/");
  const session = await verifySession(token);
  if (!session) redirect("/");

  const supabase = createSupabaseServerClient();

  const [{ data: user }, { data: memberships }, { data: ownedGames }] = await Promise.all([
    supabase
      .from("users")
      .select("app_nickname, steam_nickname, app_avatar_url, steam_avatar_url")
      .eq("id", session.userId)
      .single(),
    supabase.from("room_members").select("room_id").eq("user_id", session.userId),
    supabase.from("user_games").select("appid").eq("user_id", session.userId),
  ]);

  const roomIds = (memberships ?? []).map((m) => m.room_id as string);
  const { data: initialRooms } =
    roomIds.length > 0
      ? await supabase
          .from("rooms")
          .select(ROOM_SELECT)
          .in("id", roomIds)
          .order("created_at", { ascending: false })
      : { data: [] };

  const displayName = user ? resolveDisplayName(user) : "게이머";
  const avatarUrl = user ? resolveAvatarUrl(user) : "";
  const ownedAppIds = (ownedGames ?? []).map((g) => Number(g.appid));
  const initialBlocked =
    sp.blockedAppid && sp.blockedGame
      ? { gameAppid: Number(sp.blockedAppid), gameName: decodeURIComponent(sp.blockedGame) }
      : null;

  return (
    <RoomsClient
      initialRooms={initialRooms ?? []}
      displayName={displayName}
      avatarUrl={avatarUrl}
      ownedAppIds={ownedAppIds}
      initialBlocked={initialBlocked}
      mode="mine"
    />
  );
}
