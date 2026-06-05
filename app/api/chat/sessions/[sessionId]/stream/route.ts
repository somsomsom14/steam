import { type NextRequest } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase";
import { runChatPipeline } from "@/lib/ai/pipeline";
import type { ChatHistoryMessage } from "@/lib/ai/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ sessionId: string }> };

function sseLine(data: object) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await requireSession();
  if (!session) {
    return new Response(sseLine({ type: "error", message: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  const { sessionId } = await params;
  const body = await req.json();
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) {
    return new Response(sseLine({ type: "error", message: "메시지가 비어 있습니다." }), {
      status: 400,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  const supabase = createSupabaseServerClient();

  const { data: chatSession } = await supabase
    .from("chat_sessions")
    .select("id, title")
    .eq("id", sessionId)
    .eq("user_id", session.userId)
    .maybeSingle();

  if (!chatSession) {
    return new Response(sseLine({ type: "error", message: "세션을 찾을 수 없습니다." }), {
      status: 404,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  const { data: existingMessages } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  const history: ChatHistoryMessage[] = (existingMessages ?? []).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content as string,
  }));

  const { error: userInsertErr } = await supabase.from("chat_messages").insert({
    session_id: sessionId,
    user_id: session.userId,
    role: "user",
    content,
  });
  if (userInsertErr) {
    return new Response(sseLine({ type: "error", message: userInsertErr.message }), {
      status: 500,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  const isFirstUserMessage = history.filter((m) => m.role === "user").length === 0;
  const newTitle = isFirstUserMessage ? content.slice(0, 40) + (content.length > 40 ? "…" : "") : null;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (payload: object) => controller.enqueue(encoder.encode(sseLine(payload)));

      let fullText = "";
      let intent = "일반문의";

      try {
        send({ type: "status", message: "응답 생성 중" });

        const generator = runChatPipeline({
          userId: session.userId,
          userMessage: content,
          history,
        });

        while (true) {
          const { value, done } = await generator.next();
          if (done) {
            intent = value.intent;
            break;
          }
          fullText += value;
          send({ type: "chunk", text: value });
        }

        const { data: assistantRow, error: assistantErr } = await supabase
          .from("chat_messages")
          .insert({
            session_id: sessionId,
            user_id: session.userId,
            role: "assistant",
            content: fullText || "(응답 없음)",
          })
          .select("id")
          .single();

        if (assistantErr) {
          send({ type: "error", message: assistantErr.message });
        } else {
          await supabase
            .from("chat_sessions")
            .update({
              updated_at: new Date().toISOString(),
              ...(newTitle ? { title: newTitle } : {}),
            })
            .eq("id", sessionId);

          send({
            type: "done",
            messageId: assistantRow?.id,
            intent,
            title: newTitle ?? chatSession.title,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "AI 응답 생성 실패";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
