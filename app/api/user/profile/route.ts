import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase";

const VALID_GENDERS = ["male", "female", "private"] as const;
type Gender = (typeof VALID_GENDERS)[number];

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await verifySession(token);
  if (!session) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  const body = (await req.json()) as {
    app_nickname: string;
    app_avatar_url?: string | null;
    gender?: string;
  };

  if (!body.app_nickname?.trim()) {
    return NextResponse.json({ error: "닉네임을 입력해주세요." }, { status: 400 });
  }

  const gender: Gender = VALID_GENDERS.includes(body.gender as Gender)
    ? (body.gender as Gender)
    : "private";

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("users")
    .update({
      app_nickname: body.app_nickname.trim(),
      app_avatar_url: body.app_avatar_url ?? null,
      gender,
      profile_completed: true,
    })
    .eq("id", session.userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
