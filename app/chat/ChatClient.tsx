"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ProfileAvatar } from "@/components/dashboard/ProfileAvatar";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import "@/components/dashboard/dashboard.css";
import "./chat.css";

type ChatSession = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

type Props = {
  displayName: string;
  avatarUrl: string;
  steamId: string;
  initialSessions: ChatSession[];
  initialSessionId: string | null;
  initialMessages: ChatMessage[];
};

const WELCOME =
  "안녕하세요! MI-TEAM AI 문의방입니다.\n게임 추천, 방 추천, Steam 성향 분석, 서비스 이용 문의를 도와드릴게요.";

export function ChatClient({
  displayName,
  avatarUrl,
  steamId,
  initialSessions,
  initialSessionId,
  initialMessages,
}: Props) {
  const [sessions, setSessions] = useState<ChatSession[]>(initialSessions);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(initialSessionId);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState("");
  const [activeIntent, setActiveIntent] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollBottom();
  }, [messages, streamBuffer, streaming, scrollBottom]);

  const loadMessages = useCallback(async (sessionId: string) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}/messages`);
      if (res.ok) {
        const data = (await res.json()) as ChatMessage[];
        setMessages(data);
      }
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const selectSession = useCallback(
    async (sessionId: string) => {
      if (streaming) return;
      setActiveSessionId(sessionId);
      setStreamBuffer("");
      setActiveIntent(null);
      await loadMessages(sessionId);
    },
    [loadMessages, streaming]
  );

  const createSession = useCallback(async () => {
    if (streaming) return;
    const res = await fetch("/api/chat/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "새 대화" }),
    });
    if (!res.ok) return;
    const created = (await res.json()) as ChatSession;
    setSessions((prev) => [created, ...prev]);
    setActiveSessionId(created.id);
    setMessages([]);
    setStreamBuffer("");
    setActiveIntent(null);
  }, [streaming]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || streaming) return;

    let sessionId = activeSessionId;
    if (!sessionId) {
      const res = await fetch("/api/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "새 대화" }),
      });
      if (!res.ok) return;
      const created = (await res.json()) as ChatSession;
      sessionId = created.id;
      setSessions((prev) => [created, ...prev]);
      setActiveSessionId(created.id);
    }

    setInput("");
    setMessages((prev) => [
      ...prev,
      {
        id: `temp-user-${Date.now()}`,
        role: "user",
        content: text,
        created_at: new Date().toISOString(),
      },
    ]);

    setStreaming(true);
    setStreamBuffer("");
    setActiveIntent(null);

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
        signal: ac.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error("응답을 받지 못했습니다.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const payload = JSON.parse(line.slice(6)) as {
              type: string;
              text?: string;
              message?: string;
              messageId?: string;
              intent?: string;
              title?: string;
            };

            if (payload.type === "chunk" && payload.text) {
              accumulated += payload.text;
              setStreamBuffer(accumulated);
            } else if (payload.type === "done") {
              if (payload.intent) setActiveIntent(payload.intent);
              if (payload.title && sessionId) {
                setSessions((prev) =>
                  prev.map((s) =>
                    s.id === sessionId ? { ...s, title: payload.title!, updated_at: new Date().toISOString() } : s
                  )
                );
              }
              await loadMessages(sessionId);
            } else if (payload.type === "error") {
              throw new Error(payload.message ?? "오류");
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: "assistant",
            content: err instanceof Error ? err.message : "오류가 발생했습니다.",
            created_at: new Date().toISOString(),
          },
        ]);
      }
    } finally {
      setStreaming(false);
      setStreamBuffer("");
      abortRef.current = null;
    }
  }

  const showWelcome = messages.length === 0 && !streaming && !loadingMessages;

  return (
    <div className="dashboard-shell">
      <DashboardSidebar activePath="/chat" />

      <div className="dashboard-right">
        <header className="dashboard-topbar">
          <a href="/" className="dashboard-mobile-logo">
            MI-TEAM
          </a>
          <a href="/profile" className="dashboard-topbar__profile" style={{ textDecoration: "none", cursor: "pointer" }}>
            <ProfileAvatar src={avatarUrl} alt="" className="dashboard-topbar__avatar" />
            <div className="dashboard-topbar__info">
              <div className="dashboard-topbar__name">{displayName}</div>
              <div className="dashboard-topbar__id">
                ID: <strong>{steamId.slice(-7)}</strong>
              </div>
              <svg className="dashboard-topbar__chevron" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 10l5 5 5-5H7z" />
              </svg>
            </div>
          </a>
        </header>

        <div className="dashboard-dark ai-chat-body">
          <div className="ai-chat-layout">
            <aside className="ai-chat-sessions">
              <button type="button" className="ai-chat-sessions__new" onClick={createSession} disabled={streaming}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                새 대화
              </button>
              <div className="ai-chat-sessions__list">
                {sessions.length === 0 && (
                  <p className="ai-chat-sessions__empty">대화를 시작해 보세요</p>
                )}
                {sessions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`ai-chat-sessions__item${activeSessionId === s.id ? " is-active" : ""}`}
                    onClick={() => selectSession(s.id)}
                    disabled={streaming}
                  >
                    <span className="ai-chat-sessions__item-title">{s.title}</span>
                    <span className="ai-chat-sessions__item-date">
                      {new Date(s.updated_at).toLocaleDateString("ko-KR", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </button>
                ))}
              </div>
            </aside>

            <main className="ai-chat-main">
              <div className="ai-chat-main__header">
                <h1 className="ai-chat-main__title">AI 문의방</h1>
                {activeIntent && (
                  <span className="ai-chat-main__intent">{activeIntent}</span>
                )}
              </div>

              <div className="ai-chat-main__messages">
                {loadingMessages && (
                  <p className="ai-chat-main__loading">대화 불러오는 중...</p>
                )}

                {showWelcome && (
                  <div className="ai-chat-bubble ai-chat-bubble--assistant">
                    <span className="ai-chat-bubble__label">MI-TEAM AI</span>
                    <p className="ai-chat-bubble__text">{WELCOME}</p>
                  </div>
                )}

                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`ai-chat-bubble ai-chat-bubble--${msg.role}`}
                  >
                    <span className="ai-chat-bubble__label">
                      {msg.role === "user" ? displayName : "MI-TEAM AI"}
                    </span>
                    <p className="ai-chat-bubble__text">{msg.content}</p>
                  </div>
                ))}

                {streaming && (
                  <div className="ai-chat-bubble ai-chat-bubble--assistant">
                    <span className="ai-chat-bubble__label">MI-TEAM AI</span>
                    {streamBuffer ? (
                      <p className="ai-chat-bubble__text">{streamBuffer}</p>
                    ) : (
                      <div className="ai-chat-typing" aria-label="입력 중">
                        <span />
                        <span />
                        <span />
                      </div>
                    )}
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              <div className="ai-chat-main__input-bar">
                <textarea
                  className="ai-chat-main__input"
                  rows={2}
                  placeholder="게임 추천, 방 추천, 성향 분석 등 무엇이든 물어보세요..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  disabled={streaming}
                />
                <button
                  type="button"
                  className="ai-chat-main__send"
                  onClick={sendMessage}
                  disabled={!input.trim() || streaming}
                >
                  전송
                </button>
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
