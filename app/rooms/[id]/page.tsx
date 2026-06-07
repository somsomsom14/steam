import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { verifySession } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase";
import { RoomChatClient } from "./RoomChatClient";
import "../rooms.css";

type Params = { params: Promise<{ id: string }> };

type UserSnippet = {
  app_nickname: string | null;
  steam_nickname: string | null;
  app_avatar_url: string | null;
  steam_avatar_url: string | null;
};

function unwrapJoin<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default async function RoomPage({ params }: Params) {
  const { id } = await params;

  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) redirect("/");
  const session = await verifySession(token);
  if (!session) redirect("/");

  const supabase = createSupabaseServerClient();

  const { data: room } = await supabase
    .from("rooms")
    .select(`*, host:users!host_id(app_nickname, steam_nickname, app_avatar_url, steam_avatar_url)`)
    .eq("id", id)
    .maybeSingle();

  if (!room) {
    return (
      <div className="chat-denied">
        <h2>방을 찾을 수 없습니다.</h2>
        <Link href="/rooms">방 목록으로 돌아가기</Link>
      </div>
    );
  }

  const { data: banned } = await supabase.from("room_banned").select("user_id").eq("room_id", id).eq("user_id", session.userId).maybeSingle();
  if (banned) {
    return (
      <div className="chat-denied">
        <h2>입장이 제한된 방입니다.</h2>
        <Link href="/rooms">방 목록으로 돌아가기</Link>
      </div>
    );
  }

  const { data: owned } = await supabase.from("user_games").select("appid").eq("user_id", session.userId).eq("appid", room.game_appid).maybeSingle();
  if (!owned) {
    const q = new URLSearchParams({
      blockedAppid: String(room.game_appid),
      blockedGame: room.game_name,
    });
    redirect(`/rooms?${q.toString()}`);
  }

  // Auto-join if not yet a member
  await supabase.from("room_members").upsert({ room_id: id, user_id: session.userId, role: "member" }, { onConflict: "room_id,user_id", ignoreDuplicates: true });

  const [{ data: currentUser }, { data: members }, { data: initialMessages }, { data: schedulesRaw }] = await Promise.all([
    supabase.from("users").select("id, app_nickname, steam_nickname, app_avatar_url, steam_avatar_url").eq("id", session.userId).single(),
    supabase.from("room_members").select(`role, joined_at, user:users!user_id(id, app_nickname, steam_nickname, app_avatar_url, steam_avatar_url)`).eq("room_id", id),
    supabase.from("room_messages").select(`id, room_id, user_id, message, message_type, attachment_url, created_at, user:users!user_id(app_nickname, steam_nickname, app_avatar_url, steam_avatar_url)`).eq("room_id", id).order("created_at", { ascending: true }).limit(100),
    supabase.from("room_schedules").select(`id, room_id, creator_id, content, target_time, created_at, creator:users!creator_id(app_nickname, steam_nickname)`).eq("room_id", id).order("target_time", { ascending: false }),
  ]);

  const schedules = schedulesRaw ?? [];
  let initialSchedules = schedules.map((s) => ({
    ...s,
    creator: unwrapJoin(s.creator) as { app_nickname: string | null; steam_nickname: string | null } | null,
    participants: [] as { user_id: string; user: { app_nickname: string | null; steam_nickname: string | null } | null }[],
  }));
  if (schedules.length > 0) {
    const { data: participantRows } = await supabase
      .from("room_schedule_participants")
      .select("schedule_id, user_id, user:users!user_id(app_nickname, steam_nickname)")
      .in("schedule_id", schedules.map((s) => s.id));
    const bySchedule = new Map<string, typeof initialSchedules[0]["participants"]>();
    for (const row of participantRows ?? []) {
      const sid = row.schedule_id as string;
      const list = bySchedule.get(sid) ?? [];
      list.push({
        user_id: row.user_id as string,
        user: unwrapJoin(row.user) as { app_nickname: string | null; steam_nickname: string | null } | null,
      });
      bySchedule.set(sid, list);
    }
    initialSchedules = schedules.map((s) => ({
      ...s,
      creator: unwrapJoin(s.creator) as { app_nickname: string | null; steam_nickname: string | null } | null,
      participants: bySchedule.get(s.id) ?? [],
    }));
  }

  const normalizedMembers = (members ?? []).map((m) => ({
    role: (m.role === "host" ? "host" : "member") as "host" | "member",
    joined_at: m.joined_at as string,
    user: unwrapJoin(m.user) as ({ id: string } & UserSnippet) | null,
  }));

  const normalizedMessages = (initialMessages ?? []).map((m) => ({
    id: m.id as string,
    room_id: m.room_id as string,
    user_id: m.user_id as string,
    message: m.message as string,
    message_type: (m.message_type === "image" ? "image" : "text") as "text" | "image",
    attachment_url: (m.attachment_url as string | null) ?? null,
    created_at: m.created_at as string,
    user: unwrapJoin(m.user) as UserSnippet | null,
  }));

  return (
    <RoomChatClient
      room={room}
      currentUserId={session.userId}
      currentUser={{
        id: session.userId,
        nickname: currentUser?.app_nickname || currentUser?.steam_nickname || "게이머",
        avatar: currentUser?.app_avatar_url || currentUser?.steam_avatar_url || "",
      }}
      initialMembers={normalizedMembers}
      initialMessages={normalizedMessages}
      initialSchedules={initialSchedules}
    />
  );
}
