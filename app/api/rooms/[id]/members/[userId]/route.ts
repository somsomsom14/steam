import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase";

type Ctx = { params: Promise<{ id: string; userId: string }> };

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id, userId } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const session = await verifySession(token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseServerClient();
  const { data: room } = await supabase.from("rooms").select("host_id").eq("id", id).single();
  if (room?.host_id !== session.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (userId === session.userId) return NextResponse.json({ error: "방장은 추방할 수 없습니다." }, { status: 400 });

  await supabase.from("room_members").delete().eq("room_id", id).eq("user_id", userId);
  await supabase.from("room_banned").upsert({ room_id: id, user_id: userId }, { onConflict: "room_id,user_id", ignoreDuplicates: true });

  return NextResponse.json({ ok: true });
}
