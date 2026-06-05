import { type NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase";

type Ctx = { params: Promise<{ sessionId: string }> };

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId } = await params;
  const supabase = createSupabaseServerClient();

  const { data: owned } = await supabase
    .from("chat_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", session.userId)
    .maybeSingle();

  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabase.from("chat_sessions").delete().eq("id", sessionId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
