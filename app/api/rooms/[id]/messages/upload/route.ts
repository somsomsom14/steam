import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase";

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 5 * 1024 * 1024;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id: roomId } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await verifySession(token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseServerClient();
  const { data: member } = await supabase
    .from("room_members")
    .select("user_id")
    .eq("room_id", roomId)
    .eq("user_id", session.userId)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "방 멤버가 아닙니다." }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "jpg, png, webp, gif 형식만 업로드할 수 있습니다." },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "최대 5MB까지 업로드 가능합니다." }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const safeExt = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ? ext : "jpg";
  const path = `${roomId}/${session.userId}/${Date.now()}.${safeExt === "jpeg" ? "jpg" : safeExt}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("room-chat")
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    const hint =
      uploadError.message.includes("Bucket not found") || uploadError.message.includes("not found")
        ? " Supabase에서 room-chat 버킷을 생성해 주세요."
        : "";
    return NextResponse.json(
      { error: `이미지 업로드 실패: ${uploadError.message}${hint}` },
      { status: 500 }
    );
  }

  const { data: urlData } = supabase.storage.from("room-chat").getPublicUrl(path);
  return NextResponse.json({ url: urlData.publicUrl });
}
