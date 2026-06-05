"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnalysisMessageBody } from "@/components/chat/AnalysisMessageBody";
import { GameRecommendCards } from "@/components/chat/GameRecommendCards";
import { ProfileAvatar } from "@/components/dashboard/ProfileAvatar";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { splitAssistantContent } from "@/lib/ai/game-recommend-utils";
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
  /** 대시보드 등에서 진입 시 자동으로 보낼 메시지 */
  autoStartMessage?: string | null;
};

const SUGGESTED_QUESTIONS = [
  {
    message: "게임 성향 분석해줘",
    title: "게임 성향 분석",
    subtitle: "Steam DNA·플레이 스타일 상세 보고서",
    icon: "dna",
  },
  {
    message: "게임 추천해줘",
    title: "게임 추천",
    subtitle: "내 취향에 맞는 게임 2가지 추천",
    icon: "game",
  },
  {
    message: "게임 데이터가 안나와",
    title: "게임 데이터 안내",
    subtitle: "대시보드·동기화 문제 해결",
    icon: "sync",
  },
] as const;

function AssistantMessageBody({
  content,
  onMoreRecs,
  disabled,
}: {
  content: string;
  onMoreRecs: () => void;
  disabled?: boolean;
}) {
  const { text, games } = splitAssistantContent(content);

  if (games && games.length > 0) {
    return (
      <GameRecommendCards
        intro={text}
        games={games}
        onMoreRecs={onMoreRecs}
        disabled={disabled}
      />
    );
  }

  return <AnalysisMessageBody content={content} />;
}

export function ChatClient({
  displayName,
  avatarUrl,
  steamId,
  initialSessions,
  initialSessionId,
  initialMessages,
  autoStartMessage = null,
}: Props) {
  const [sessions, setSessions] = useState<ChatSession[]>(initialSessions);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(initialSessionId);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState("");
  const [activeIntent, setActiveIntent] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deletingSession, setDeletingSession] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamFlushRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamAccumRef = useRef("");
  const timedOutRef = useRef(false);
  const autoStartDoneRef = useRef(false);

  const scrollBottom = useCallback((smooth = false) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => {
    scrollBottom(false);
  }, [messages.length, loadingMessages, scrollBottom]);

  useEffect(() => {
    if (streaming) scrollBottom(false);
  }, [streaming, scrollBottom]);

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

  const openDeleteConfirm = useCallback(
    (sessionId: string) => {
      if (streaming || deletingSession) return;
      setDeleteTargetId(sessionId);
    },
    [deletingSession, streaming]
  );

  const closeDeleteConfirm = useCallback(() => {
    if (deletingSession) return;
    setDeleteTargetId(null);
  }, [deletingSession]);

  const confirmDeleteSession = useCallback(async () => {
    if (!deleteTargetId || streaming || deletingSession) return;

    const sessionId = deleteTargetId;
    setDeletingSession(true);

    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`, { method: "DELETE" });
      if (!res.ok) return;

      setDeleteTargetId(null);

      let nextActiveId: string | null | undefined;
      setSessions((prev) => {
        const remaining = prev.filter((s) => s.id !== sessionId);
        if (activeSessionId === sessionId) {
          nextActiveId = remaining[0]?.id ?? null;
        }
        return remaining;
      });

      if (nextActiveId !== undefined) {
        setActiveSessionId(nextActiveId);
        setStreamBuffer("");
        setActiveIntent(null);
        if (nextActiveId) {
          await loadMessages(nextActiveId);
        } else {
          setMessages([]);
        }
      }
    } finally {
      setDeletingSession(false);
    }
  }, [activeSessionId, deleteTargetId, deletingSession, loadMessages, streaming]);

  const sendMessage = useCallback(
    async (overrideText?: string, options?: { sessionId?: string }) => {
      const text = (overrideText ?? input).trim();
      if (!text || streaming) return;

      let sessionId = options?.sessionId ?? activeSessionId;
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

      if (!overrideText) setInput("");
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
      streamAccumRef.current = "";
      timedOutRef.current = false;

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      const requestTimeout = setTimeout(() => {
        timedOutRef.current = true;
        ac.abort();
      }, 90_000);

      const flushStreamBuffer = (force = false) => {
        if (streamFlushRef.current) {
          clearTimeout(streamFlushRef.current);
          streamFlushRef.current = null;
        }
        if (force) {
          setStreamBuffer(streamAccumRef.current);
          return;
        }
        streamFlushRef.current = setTimeout(() => {
          setStreamBuffer(streamAccumRef.current);
          streamFlushRef.current = null;
          scrollBottom(false);
        }, 48);
      };

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
                intent?: string;
                title?: string;
              };

              if (payload.type === "chunk" && payload.text) {
                streamAccumRef.current += payload.text;
                flushStreamBuffer();
              } else if (payload.type === "done") {
                flushStreamBuffer(true);
                if (payload.intent) setActiveIntent(payload.intent);
                if (payload.title && sessionId) {
                  setSessions((prev) =>
                    prev.map((s) =>
                      s.id === sessionId
                        ? { ...s, title: payload.title!, updated_at: new Date().toISOString() }
                        : s
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
        } else if (timedOutRef.current) {
          setMessages((prev) => [
            ...prev,
            {
              id: `err-${Date.now()}`,
              role: "assistant",
              content: "응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.",
              created_at: new Date().toISOString(),
            },
          ]);
        }
      } finally {
        clearTimeout(requestTimeout);
        if (streamFlushRef.current) {
          clearTimeout(streamFlushRef.current);
          streamFlushRef.current = null;
        }
        setStreaming(false);
        setStreamBuffer("");
        streamAccumRef.current = "";
        abortRef.current = null;
      }
    },
    [activeSessionId, input, loadMessages, scrollBottom, streaming]
  );

  const requestMoreGameRecs = useCallback(() => {
    void sendMessage("더 추천받기");
  }, [sendMessage]);

  useEffect(() => {
    if (!autoStartMessage || autoStartDoneRef.current) return;
    autoStartDoneRef.current = true;

    (async () => {
      const res = await fetch("/api/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "게임 성향 분석" }),
      });
      if (!res.ok) return;
      const created = (await res.json()) as ChatSession;
      setSessions((prev) => [created, ...prev]);
      setActiveSessionId(created.id);
      setMessages([]);
      setStreamBuffer("");
      setActiveIntent(null);
      await sendMessage(autoStartMessage, { sessionId: created.id });
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", "/chat");
      }
    })();
  }, [autoStartMessage, sendMessage]);

  const showWelcome = messages.length === 0 && !streaming && !loadingMessages;

  return (
    <div className="dashboard-shell">
      <DashboardSidebar activePath="/chat" />

      <div className="dashboard-right">
        <header className="dashboard-topbar">
          <a href="/dashboard" className="dashboard-mobile-logo">
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
                  <div
                    key={s.id}
                    className={`ai-chat-sessions__row${activeSessionId === s.id ? " is-active" : ""}`}
                  >
                    <button
                      type="button"
                      className="ai-chat-sessions__item"
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
                    <button
                      type="button"
                      className="ai-chat-sessions__delete"
                      onClick={() => openDeleteConfirm(s.id)}
                      disabled={streaming}
                      aria-label="채팅 기록 삭제"
                      title="채팅 기록 삭제"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </aside>

            <main className="ai-chat-main">
              <div className="ai-chat-main__header">
                <h1 className="ai-chat-main__title">AI 문의방</h1>
                {activeIntent && (
                  <span className="ai-chat-main__intent">{activeIntent}</span>
                )}
                {activeSessionId && (
                  <button
                    type="button"
                    className="ai-chat-main__delete"
                    onClick={() => openDeleteConfirm(activeSessionId)}
                    disabled={streaming}
                  >
                    채팅 기록 삭제
                  </button>
                )}
              </div>

              <div
                className={`ai-chat-main__messages${showWelcome ? " ai-chat-main__messages--welcome" : ""}`}
              >
                {loadingMessages && (
                  <p className="ai-chat-main__loading">대화 불러오는 중...</p>
                )}

                {showWelcome && (
                  <div className="ai-chat-welcome">
                    <div className="ai-chat-welcome__icon" aria-hidden>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="5" y="8" width="14" height="11" rx="2" />
                        <path d="M9 8V6a3 3 0 016 0v2" />
                        <circle cx="10" cy="13" r="1" fill="currentColor" />
                        <circle cx="14" cy="13" r="1" fill="currentColor" />
                        <path d="M8 17h8" />
                      </svg>
                    </div>
                    <h2 className="ai-chat-welcome__title">무엇을 도와드릴까요?</h2>
                    <p className="ai-chat-welcome__desc">
                      MI-TEAM AI가 게임 성향·추천·Steam 데이터 문의에 답해 드려요.
                      <br />
                      아래 주제를 선택하거나 직접 질문을 입력해 보세요.
                    </p>
                    <p className="ai-chat-welcome__faq-label">자주 묻는 질문으로 시작해 보세요</p>
                    <div className="ai-chat-welcome__cards">
                      {SUGGESTED_QUESTIONS.map((q) => (
                        <button
                          key={q.message}
                          type="button"
                          className="ai-chat-welcome__card"
                          onClick={() => void sendMessage(q.message)}
                          disabled={streaming}
                        >
                          <span className={`ai-chat-welcome__card-icon ai-chat-welcome__card-icon--${q.icon}`}>
                            {q.icon === "dna" && (
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M4 12c2-4 4-4 8-4s6 0 8 4M4 12c2 4 4 4 8 4s6 0 8-4M4 12h16" />
                              </svg>
                            )}
                            {q.icon === "game" && (
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="8" width="18" height="10" rx="2" />
                                <path d="M8 12h2M14 12h2" />
                              </svg>
                            )}
                            {q.icon === "sync" && (
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M4 12a8 8 0 0114-5M20 12a8 8 0 01-14 5" />
                                <path d="M18 4v4h-4M6 20v-4H2" />
                              </svg>
                            )}
                          </span>
                          <span className="ai-chat-welcome__card-title">{q.title}</span>
                          <span className="ai-chat-welcome__card-sub">{q.subtitle}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg) => {
                  const { games } =
                    msg.role === "assistant" ? splitAssistantContent(msg.content) : { games: null };
                  return (
                    <div
                      key={msg.id}
                      className={`ai-chat-bubble ai-chat-bubble--${msg.role}${
                        games?.length ? " ai-chat-bubble--wide" : ""
                      }`}
                    >
                      <span className="ai-chat-bubble__label">
                        {msg.role === "user" ? displayName : "MI-TEAM AI"}
                      </span>
                      {msg.role === "assistant" ? (
                        <AssistantMessageBody
                          content={msg.content}
                          onMoreRecs={requestMoreGameRecs}
                          disabled={streaming}
                        />
                      ) : (
                        <p className="ai-chat-bubble__text">{msg.content}</p>
                      )}
                    </div>
                  );
                })}

                {streaming && (
                  <div className="ai-chat-bubble ai-chat-bubble--assistant">
                    <span className="ai-chat-bubble__label">MI-TEAM AI</span>
                    {streamBuffer ? (
                      <AnalysisMessageBody content={streamBuffer} />
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
                      void sendMessage();
                    }
                  }}
                  disabled={streaming}
                />
                <button
                  type="button"
                  className="ai-chat-main__send"
                  onClick={() => void sendMessage()}
                  disabled={!input.trim() || streaming}
                >
                  전송
                </button>
              </div>
            </main>
          </div>
        </div>
      </div>

      {deleteTargetId && (
        <div
          className="ai-chat-confirm-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDeleteConfirm();
          }}
        >
          <div
            className="ai-chat-confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-chat-confirm-title"
          >
            <h2 id="ai-chat-confirm-title" className="ai-chat-confirm__title">
              이 대화의 채팅 기록을 삭제할까요?
            </h2>
            <p className="ai-chat-confirm__desc">삭제하면 복구할 수 없습니다.</p>
            <div className="ai-chat-confirm__actions">
              <button
                type="button"
                className="ai-chat-confirm__cancel"
                onClick={closeDeleteConfirm}
                disabled={deletingSession}
              >
                취소
              </button>
              <button
                type="button"
                className="ai-chat-confirm__ok"
                onClick={() => void confirmDeleteSession()}
                disabled={deletingSession}
              >
                {deletingSession ? "삭제 중..." : "확인"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
