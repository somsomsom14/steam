import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await verifySession(token);
  if (!session) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  const { agreed } = (await req.json()) as { agreed: boolean };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("users")
    .update({
      analysis_agreed: agreed,
      analysis_agreed_at: agreed ? new Date().toISOString() : null,
    })
    .eq("id", session.userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
