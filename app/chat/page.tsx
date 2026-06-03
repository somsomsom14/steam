import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/session";
import { resolveAvatarUrl, resolveDisplayName } from "@/lib/user-profile";
import { createSupabaseServerClient } from "@/lib/supabase";
import { ChatClient } from "./ChatClient";

export default async function ChatPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) redirect("/");
  const session = await verifySession(token);
  if (!session) redirect("/");

  const supabase = createSupabaseServerClient();
  const { data: user } = await supabase
    .from("users")
    .select("app_nickname, steam_nickname, app_avatar_url, steam_avatar_url")
    .eq("id", session.userId)
    .single();

  const displayName = user ? resolveDisplayName(user) : "게이머";
  const avatarUrl = user ? resolveAvatarUrl(user) : "";

  return (
    <ChatClient
      displayName={displayName}
      avatarUrl={avatarUrl}
      steamId={session.steamId}
    />
  );
}
