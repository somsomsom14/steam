import { type NextRequest, NextResponse } from "next/server";
import { verifySteamCallback, getPlayerSummaries } from "@/lib/steam";
import { createSupabaseServerClient } from "@/lib/supabase";
import { createSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  // 1. Steam OpenID 검증
  const steamId = await verifySteamCallback(req.nextUrl.searchParams);
  if (!steamId) {
    return NextResponse.redirect(`${siteUrl}/?error=auth_failed`);
  }

  const supabase = createSupabaseServerClient();

  // 2. 기존 유저 확인 (재로그인 여부)
  const { data: existing } = await supabase
    .from("users")
    .select("id, profile_completed")
    .eq("steam_id", steamId)
    .single();

  let userId: string;

  if (existing) {
    // 재로그인 — Steam API 재호출 없이 기존 데이터 그대로 사용
    userId = existing.id;
  } else {
    // 최초 로그인 — Steam API 호출 후 신규 유저 생성
    const player = await getPlayerSummaries(steamId);
    if (!player) {
      return NextResponse.redirect(`${siteUrl}/?error=steam_api_failed`);
    }

    const { data: newUser, error } = await supabase
      .from("users")
      .insert({
        steam_id: steamId,
        steam_nickname: player.personaname,
        steam_avatar_url: player.avatarfull,
        steam_profile_url: player.profileurl,
      })
      .select("id")
      .single();

    if (error || !newUser) {
      console.error("[callback] Supabase insert error:", error);
      return NextResponse.redirect(`${siteUrl}/?error=db_error`);
    }
    userId = newUser.id;
  }

  // 3. JWT 세션 쿠키 발급
  const token = await createSession({ userId, steamId });

  // 프로필 완료된 재로그인 → 대시보드, 나머지 → 온보딩
  const redirectPath =
    existing?.profile_completed ? "/dashboard" : "/onboarding";

  const response = NextResponse.redirect(`${siteUrl}${redirectPath}`);
  response.cookies.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return response;
}
