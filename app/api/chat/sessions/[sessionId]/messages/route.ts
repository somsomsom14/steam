import { type NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase";

type Ctx = { params: Promise<{ sessionId: string }> };

async function assertSessionOwner(userId: string, sessionId: string) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("chat_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId } = await params;
  if (!(await assertSessionOwner(session.userId, sessionId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, role, content, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
