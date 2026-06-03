import { NextResponse } from "next/server";
import { buildSteamLoginUrl } from "@/lib/steam";

export async function GET() {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const callbackUrl = `${siteUrl}/api/auth/steam/callback`;
  const loginUrl = buildSteamLoginUrl(callbackUrl, siteUrl);
  return NextResponse.redirect(loginUrl);
}
