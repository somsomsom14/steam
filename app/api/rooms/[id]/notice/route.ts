import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const session = await verifySession(token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseServerClient();
  const { data: room } = await supabase.from("rooms").select("host_id").eq("id", id).single();
  if (room?.host_id !== session.userId) return NextResponse.json({ error: "방장만 공지를 수정할 수 있습니다." }, { status: 403 });

  const { notice } = await req.json();
  const { error } = await supabase.from("rooms").update({ notice: notice?.trim() ?? null }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
