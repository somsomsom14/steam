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

  const [{ data: user }, { data: sessions }] = await Promise.all([
    supabase
      .from("users")
      .select("app_nickname, steam_nickname, app_avatar_url, steam_avatar_url")
      .eq("id", session.userId)
      .single(),
    supabase
      .from("chat_sessions")
      .select("id, title, created_at, updated_at")
      .eq("user_id", session.userId)
      .order("updated_at", { ascending: false }),
  ]);

  const displayName = user ? resolveDisplayName(user) : "게이머";
  const avatarUrl = user ? resolveAvatarUrl(user) : "";

  let initialMessages: { id: string; role: string; content: string; created_at: string }[] = [];
  const sessionList = sessions ?? [];
  const activeId = sessionList[0]?.id;

  if (activeId) {
    const { data: messages } = await supabase
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("session_id", activeId)
      .order("created_at", { ascending: true });
    initialMessages = messages ?? [];
  }

  return (
    <ChatClient
      displayName={displayName}
      avatarUrl={avatarUrl}
      steamId={session.steamId}
      initialSessions={sessionList}
      initialSessionId={activeId ?? null}
      initialMessages={initialMessages}
    />
  );
}
