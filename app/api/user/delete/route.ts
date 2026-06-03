import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase";

export async function DELETE(_req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await verifySession(token);
  if (!session) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  const supabase = createSupabaseServerClient();

  // room_members, room_messages 삭제 시도 (테이블 없으면 에러 무시)
  await supabase.from("room_messages").delete().eq("user_id", session.userId);
  await supabase.from("room_members").delete().eq("user_id", session.userId);

  // users 삭제 → ON DELETE CASCADE로 user_games, user_achievements 자동 삭제
  const { error } = await supabase
    .from("users")
    .delete()
    .eq("id", session.userId);

  if (error) {
    console.error("[delete] user delete error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 세션 쿠키 만료
  const response = NextResponse.json({ success: true });
  response.cookies.set("session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
