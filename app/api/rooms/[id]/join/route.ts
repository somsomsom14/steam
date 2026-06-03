import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const session = await verifySession(token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseServerClient();

  const { data: room } = await supabase.from("rooms").select("game_appid").eq("id", id).maybeSingle();
  if (!room) return NextResponse.json({ error: "방을 찾을 수 없습니다." }, { status: 404 });

  const { data: banned } = await supabase.from("room_banned").select("user_id").eq("room_id", id).eq("user_id", session.userId).maybeSingle();
  if (banned) return NextResponse.json({ error: "입장이 제한된 방입니다." }, { status: 403 });

  const { data: owned } = await supabase.from("user_games").select("appid").eq("user_id", session.userId).eq("appid", room.game_appid).maybeSingle();
  if (!owned) return NextResponse.json({ error: "이 게임을 보유하고 있지 않습니다." }, { status: 403 });

  const { error } = await supabase.from("room_members").upsert({ room_id: id, user_id: session.userId, role: "member" }, { onConflict: "room_id,user_id", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
