import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase";

type Ctx = { params: Promise<{ id: string; scheduleId: string }> };

/** 참여 / 참여 취소 토글 */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const { id, scheduleId } = await params;
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

  const { data: schedule } = await supabase
    .from("room_schedules")
    .select("id")
    .eq("id", scheduleId)
    .eq("room_id", id)
    .maybeSingle();
  if (!schedule) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: existing } = await supabase
    .from("room_schedule_participants")
    .select("user_id")
    .eq("schedule_id", scheduleId)
    .eq("user_id", session.userId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("room_schedule_participants")
      .delete()
      .eq("schedule_id", scheduleId)
      .eq("user_id", session.userId);
    return NextResponse.json({ joined: false });
  }

  const { error } = await supabase.from("room_schedule_participants").insert({
    schedule_id: scheduleId,
    user_id: session.userId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ joined: true });
}
