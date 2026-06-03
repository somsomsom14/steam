import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const q = req.nextUrl.searchParams.get("q") ?? "";

  let query = supabase
    .from("rooms")
    .select(`
      id, title, subtitle, game_name, game_appid, game_thumbnail, host_id, tags, created_at,
      host:users!host_id(app_nickname, steam_nickname, app_avatar_url, steam_avatar_url),
      room_members(count)
    `)
    .order("created_at", { ascending: false });

  if (q) query = query.ilike("game_name", `%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const session = await verifySession(token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseServerClient();
  const body = await req.json();
  const { title, subtitle, game_name, game_appid, game_thumbnail, tags } = body;

  if (!title?.trim() || !game_name || !game_appid) {
    return NextResponse.json({ error: "필수 항목을 입력해 주세요." }, { status: 400 });
  }

  const { data: room, error: roomErr } = await supabase
    .from("rooms")
    .insert({ title: title.trim(), subtitle: subtitle?.trim() ?? null, game_name, game_appid, game_thumbnail: game_thumbnail ?? null, host_id: session.userId, tags: tags ?? [] })
    .select()
    .single();

  if (roomErr) return NextResponse.json({ error: roomErr.message }, { status: 500 });

  await supabase.from("room_members").insert({ room_id: room.id, user_id: session.userId, role: "host" });

  const { data: existingMeta } = await supabase.from("game_metadata").select("appid").eq("appid", game_appid).maybeSingle();
  if (!existingMeta) {
    const { data: ug } = await supabase.from("user_games").select("genres, tags, categories").eq("user_id", session.userId).eq("appid", game_appid).maybeSingle();
    await supabase.from("game_metadata").insert({ appid: game_appid, name: game_name, genres: ug?.genres ?? [], tags: ug?.tags ?? [], categories: ug?.categories ?? [] });
  }

  return NextResponse.json(room, { status: 201 });
}
