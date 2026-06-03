import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("rooms")
    .select(`*, host:users!host_id(app_nickname, steam_nickname, app_avatar_url, steam_avatar_url)`)
    .eq("id", id)
    .single();
  if (error) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const session = await verifySession(token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseServerClient();
  const { data: room } = await supabase.from("rooms").select("host_id").eq("id", id).single();
  if (room?.host_id !== session.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = body.title.trim();
  if (body.subtitle !== undefined) updates.subtitle = body.subtitle?.trim() ?? null;
  if (body.tags !== undefined) updates.tags = body.tags;

  const { data, error } = await supabase.from("rooms").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const session = await verifySession(token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseServerClient();
  const { data: room } = await supabase.from("rooms").select("host_id").eq("id", id).single();
  if (room?.host_id !== session.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await supabase.from("rooms").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
