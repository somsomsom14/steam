import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase";

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await verifySession(token);
  if (!session) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "jpg, jpeg, png, webp 형식만 허용됩니다." },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "최대 5MB까지 업로드 가능합니다." },
      { status: 400 }
    );
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
  const path = `${session.userId}/${Date.now()}.${safeExt === "jpeg" ? "jpg" : safeExt}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const supabase = createSupabaseServerClient();

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error("[avatar] upload error:", uploadError.message);
    const hint =
      uploadError.message.includes("Bucket not found") ||
      uploadError.message.includes("not found")
        ? " Supabase에서 avatars 버킷을 생성해 주세요."
        : "";
    return NextResponse.json(
      { error: `이미지 업로드 실패: ${uploadError.message}${hint}` },
      { status: 500 }
    );
  }

  const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
  const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`;

  // 업로드 직후 users 테이블에도 반영
  const { error: dbError } = await supabase
    .from("users")
    .update({ app_avatar_url: publicUrl })
    .eq("id", session.userId);

  if (dbError) {
    console.error("[avatar] db update error:", dbError.message);
  }

  return NextResponse.json({ url: publicUrl });
}
