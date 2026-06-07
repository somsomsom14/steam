import { type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
import { runSteamLibrarySync } from "@/lib/steam/sync-user-games";

export const maxDuration = 60;
export const runtime = "nodejs";

function sseLine(data: object) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(_req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) {
    return new Response(sseLine({ type: "error", message: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "text/event-stream" },
    });
  }
  const session = await verifySession(token);
  if (!session) {
    return new Response(sseLine({ type: "error", message: "Invalid session" }), {
      status: 401,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (payload: object) => controller.enqueue(encoder.encode(sseLine(payload)));

      try {
        const result = await runSteamLibrarySync({
          userId: session.userId,
          steamId: session.steamId,
          onProgress: (progress) => send({ type: "progress", ...progress }),
        });
        send({ type: "complete", ...result });
      } catch (err) {
        console.error("[sync/stream] failed:", err);
        send({ type: "error", message: "동기화 중 오류가 발생했습니다." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
