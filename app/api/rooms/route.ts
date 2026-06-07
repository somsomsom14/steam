import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase";

const ROOM_SELECT = `
  id, title, subtitle, game_name, game_appid, game_thumbnail, host_id, tags, created_at,
  host:users!host_id(app_nickname, steam_nickname, app_avatar_url, steam_avatar_url),
  room_members(count)
`;

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const titleQ = req.nextUrl.searchParams.get("title")?.trim() ?? "";
  const gameQ = req.nextUrl.searchParams.get("game")?.trim() ?? "";
  const legacyQ = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const mineOnly = req.nextUrl.searchParams.get("mine") === "1";

  let joinedRoomIds: string[] | null = null;
  if (mineOnly) {
    const cookieStore = await cookies();
    const token = cookieStore.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const session = await verifySession(token);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: memberships, error: memberErr } = await supabase
      .from("room_members")
      .select("room_id")
      .eq("user_id", session.userId);
    if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 500 });

    joinedRoomIds = (memberships ?? []).map((m) => m.room_id as string);
    if (joinedRoomIds.length === 0) return NextResponse.json([]);
  }

  let query = supabase
    .from("rooms")
    .select(ROOM_SELECT)
    .order("created_at", { ascending: false });

  if (joinedRoomIds) {
    query = query.in("id", joinedRoomIds);
  }

  const sanitize = (s: string) => s.replace(/[%_,]/g, "");

  if (titleQ) {
    query = query.ilike("title", `%${sanitize(titleQ)}%`);
  }
  if (gameQ) {
    query = query.ilike("game_name", `%${sanitize(gameQ)}%`);
  }
  if (!titleQ && !gameQ && legacyQ) {
    const pattern = `%${sanitize(legacyQ)}%`;
    query = query.or(`title.ilike.${pattern},game_name.ilike.${pattern}`);
  }

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
