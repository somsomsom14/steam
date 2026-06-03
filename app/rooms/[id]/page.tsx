import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { verifySession } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase";
import { RoomChatClient } from "./RoomChatClient";
import "../rooms.css";

type Params = { params: Promise<{ id: string }> };

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
    return (
      <div className="chat-denied">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3 }}>
          <rect x="3" y="5" width="18" height="12" rx="2" /><path d="M8 21h8M12 17v4" />
        </svg>
        <h2>이 게임을 보유하고 있지 않습니다.</h2>
        <p style={{ fontSize: "0.85rem" }}>이 방은 <strong>{room.game_name}</strong> 보유자만 입장할 수 있습니다.</p>
        <Link href="/rooms">방 목록으로 돌아가기</Link>
      </div>
    );
  }

  // Auto-join if not yet a member
  await supabase.from("room_members").upsert({ room_id: id, user_id: session.userId, role: "member" }, { onConflict: "room_id,user_id", ignoreDuplicates: true });

  const [{ data: currentUser }, { data: members }, { data: initialMessages }, { data: schedulesRaw }] = await Promise.all([
    supabase.from("users").select("id, app_nickname, steam_nickname, app_avatar_url, steam_avatar_url").eq("id", session.userId).single(),
    supabase.from("room_members").select(`role, joined_at, user:users!user_id(id, app_nickname, steam_nickname, app_avatar_url, steam_avatar_url)`).eq("room_id", id),
    supabase.from("room_messages").select(`id, room_id, user_id, message, created_at, user:users!user_id(app_nickname, steam_nickname, app_avatar_url, steam_avatar_url)`).eq("room_id", id).order("created_at", { ascending: true }).limit(100),
    supabase.from("room_schedules").select(`id, room_id, creator_id, content, target_time, created_at, creator:users!creator_id(app_nickname, steam_nickname)`).eq("room_id", id).order("target_time", { ascending: true }),
  ]);

  const schedules = schedulesRaw ?? [];
  let initialSchedules = schedules.map((s) => ({ ...s, participants: [] as { user_id: string; user: { app_nickname: string | null; steam_nickname: string | null } | null }[] }));
  if (schedules.length > 0) {
    const { data: participantRows } = await supabase
      .from("room_schedule_participants")
      .select("schedule_id, user_id, user:users!user_id(app_nickname, steam_nickname)")
      .in("schedule_id", schedules.map((s) => s.id));
    const bySchedule = new Map<string, typeof initialSchedules[0]["participants"]>();
    for (const row of participantRows ?? []) {
      const sid = row.schedule_id as string;
      const list = bySchedule.get(sid) ?? [];
      list.push({ user_id: row.user_id as string, user: row.user as { app_nickname: string | null; steam_nickname: string | null } | null });
      bySchedule.set(sid, list);
    }
    initialSchedules = schedules.map((s) => ({ ...s, participants: bySchedule.get(s.id) ?? [] }));
  }

  return (
    <RoomChatClient
      room={room}
      currentUserId={session.userId}
      currentUser={{
        id: session.userId,
        nickname: currentUser?.app_nickname || currentUser?.steam_nickname || "게이머",
        avatar: currentUser?.app_avatar_url || currentUser?.steam_avatar_url || "",
      }}
      initialMembers={members ?? []}
      initialMessages={initialMessages ?? []}
      initialSchedules={initialSchedules}
    />
  );
}
