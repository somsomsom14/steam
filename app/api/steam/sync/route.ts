import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
import { runSteamLibrarySync } from "@/lib/steam/sync-user-games";

export const maxDuration = 60;

export async function POST(_req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const session = await verifySession(token);
  if (!session) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  try {
    const result = await runSteamLibrarySync({
      userId: session.userId,
      steamId: session.steamId,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[sync] failed:", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
