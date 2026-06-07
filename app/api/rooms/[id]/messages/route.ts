import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase";

type Ctx = { params: Promise<{ id: string }> };

const MESSAGE_SELECT = `id, room_id, user_id, message, message_type, attachment_url, created_at, user:users!user_id(app_nickname, steam_nickname, app_avatar_url, steam_avatar_url)`;

async function requireRoomMember(roomId: string, userId: string) {
  const supabase = createSupabaseServerClient();
  const { data: member } = await supabase
    .from("room_members")
    .select("user_id")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!member;
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const session = await verifySession(token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await requireRoomMember(id, session.userId))) {
    return NextResponse.json({ error: "방 멤버가 아닙니다." }, { status: 403 });
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("room_messages")
    .select(MESSAGE_SELECT)
    .eq("room_id", id)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const session = await verifySession(token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await requireRoomMember(id, session.userId))) {
    return NextResponse.json({ error: "방 멤버가 아닙니다." }, { status: 403 });
  }

  const supabase = createSupabaseServerClient();

  const body = await req.json();
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const messageType = body.message_type === "image" ? "image" : "text";
  const attachmentUrl =
    typeof body.attachment_url === "string" ? body.attachment_url.trim() : "";

  if (messageType === "image") {
    if (!attachmentUrl) {
      return NextResponse.json({ error: "이미지 URL이 필요합니다." }, { status: 400 });
    }
  } else if (!message) {
    return NextResponse.json({ error: "메시지를 입력해 주세요." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("room_messages")
    .insert({
      room_id: id,
      user_id: session.userId,
      message,
      message_type: messageType,
      attachment_url: messageType === "image" ? attachmentUrl : null,
    })
    .select(MESSAGE_SELECT)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
