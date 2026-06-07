import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase";
import { ProfileClient } from "./ProfileClient";

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) redirect("/");

  const session = await verifySession(token);
  if (!session) redirect("/");

  const supabase = createSupabaseServerClient();
  const { data: user } = await supabase
    .from("users")
    .select(
      "steam_nickname, steam_avatar_url, app_nickname, app_avatar_url, gender, games_updated_at"
    )
    .eq("id", session.userId)
    .single();

  return (
    <ProfileClient
      steamNickname={user?.steam_nickname ?? ""}
      steamAvatarUrl={user?.steam_avatar_url ?? ""}
      appNickname={user?.app_nickname ?? ""}
      appAvatarUrl={user?.app_avatar_url ?? ""}
      gender={(user?.gender as "male" | "female" | "private") ?? "private"}
      gamesUpdatedAt={user?.games_updated_at ?? null}
    />
  );
}
