import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase";

type Ctx = { params: Promise<{ id: string }> };

const SCHEDULE_SELECT = `id, room_id, creator_id, content, target_time, created_at, creator:users!creator_id(app_nickname, steam_nickname, app_avatar_url, steam_avatar_url)`;

async function attachParticipants(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  schedules: Record<string, unknown>[]
) {
  if (schedules.length === 0) return schedules;

  const ids = schedules.map((s) => s.id as string);
  const { data: rows } = await supabase
    .from("room_schedule_participants")
    .select("schedule_id, user_id, user:users!user_id(app_nickname, steam_nickname)")
    .in("schedule_id", ids);

  const bySchedule = new Map<string, unknown[]>();
  for (const row of rows ?? []) {
    const sid = row.schedule_id as string;
    const list = bySchedule.get(sid) ?? [];
    list.push(row);
    bySchedule.set(sid, list);
  }

  return schedules.map((s) => ({
    ...s,
    participants: bySchedule.get(s.id as string) ?? [],
  }));
}

async function canModifySchedule(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  roomId: string,
  scheduleId: string,
  userId: string
) {
  const { data: schedule } = await supabase
    .from("room_schedules")
    .select("creator_id")
    .eq("id", scheduleId)
    .eq("room_id", roomId)
    .maybeSingle();
  if (!schedule) return { ok: false as const, status: 404 };

  const { data: room } = await supabase.from("rooms").select("host_id").eq("id", roomId).single();
  const isHost = room?.host_id === userId;
  if (!isHost && schedule.creator_id !== userId) return { ok: false as const, status: 403 };
  return { ok: true as const };
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("room_schedules")
    .select(SCHEDULE_SELECT)
    .eq("room_id", id)
    .order("target_time", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const withParticipants = await attachParticipants(supabase, data ?? []);
  return NextResponse.json(withParticipants);
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const session = await verifySession(token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseServerClient();
  const { data: member } = await supabase
    .from("room_members")
    .select("user_id")
    .eq("room_id", id)
    .eq("user_id", session.userId)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "방 멤버가 아닙니다." }, { status: 403 });

  const { content, target_time } = await req.json();
  if (!content?.trim() || !target_time) {
    return NextResponse.json({ error: "필수 항목을 입력해 주세요." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("room_schedules")
    .insert({ room_id: id, creator_id: session.userId, content: content.trim(), target_time })
    .select(SCHEDULE_SELECT)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const [withParticipants] = await attachParticipants(supabase, [data]);
  return NextResponse.json(withParticipants, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const session = await verifySession(token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { scheduleId, content, target_time } = await req.json();
  if (!scheduleId) return NextResponse.json({ error: "scheduleId required" }, { status: 400 });

  const supabase = createSupabaseServerClient();
  const perm = await canModifySchedule(supabase, id, scheduleId, session.userId);
  if (!perm.ok) return NextResponse.json({ error: perm.status === 404 ? "Not found" : "Forbidden" }, { status: perm.status });

  const updates: { content?: string; target_time?: string } = {};
  if (content?.trim()) updates.content = content.trim();
  if (target_time) updates.target_time = target_time;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "수정할 내용이 없습니다." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("room_schedules")
    .update(updates)
    .eq("id", scheduleId)
    .eq("room_id", id)
    .select(SCHEDULE_SELECT)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const [withParticipants] = await attachParticipants(supabase, [data]);
  return NextResponse.json(withParticipants);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const session = await verifySession(token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseServerClient();
  const { scheduleId } = await req.json();
  if (!scheduleId) return NextResponse.json({ error: "scheduleId required" }, { status: 400 });

  const perm = await canModifySchedule(supabase, id, scheduleId, session.userId);
  if (!perm.ok) return NextResponse.json({ error: perm.status === 404 ? "Not found" : "Forbidden" }, { status: perm.status });

  await supabase.from("room_schedules").delete().eq("id", scheduleId);
  return NextResponse.json({ ok: true });
}
