"use client";

import { useState } from "react";
import { ProfileAvatar } from "@/components/dashboard/ProfileAvatar";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import "@/components/dashboard/dashboard.css";
import "./chat.css";

type Props = {
  displayName: string;
  avatarUrl: string;
  steamId: string;
};

type ChatMessage = { role: "user" | "assistant"; text: string };

export function ChatClient({ displayName, avatarUrl, steamId }: Props) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "안녕하세요! MI-TEAM AI 문의방입니다. 팀 매칭, 게임 추천, 대시보드 이용 방법 등 궁금한 점을 물어보세요.",
    },
  ]);
  const [sending, setSending] = useState(false);

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setSending(true);
    try {
      // TODO: AI API 연동
      await new Promise((r) => setTimeout(r, 600));
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "답변 기능을 준비 중입니다. 곧 AI가 도와드릴게요!",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

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
          <div className="ai-chat">
            <div className="ai-chat__header">
              <h1 className="ai-chat__title">AI 문의방</h1>
              <p className="ai-chat__subtitle">게임·팀 매칭 관련 질문을 AI에게 물어보세요</p>
            </div>

            <div className="ai-chat__messages">
              {messages.map((msg, i) => (
                <div key={i} className={`ai-chat__msg ai-chat__msg--${msg.role}`}>
                  <span className="ai-chat__msg-label">{msg.role === "user" ? displayName : "MI-TEAM AI"}</span>
                  <p className="ai-chat__msg-text">{msg.text}</p>
                </div>
              ))}
              {sending && (
                <div className="ai-chat__msg ai-chat__msg--assistant">
                  <span className="ai-chat__msg-label">MI-TEAM AI</span>
                  <p className="ai-chat__msg-text ai-chat__typing">입력 중...</p>
                </div>
              )}
            </div>

            <div className="ai-chat__input-bar">
              <textarea
                className="ai-chat__input"
                rows={2}
                placeholder="메시지를 입력하세요..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <button type="button" className="ai-chat__send" onClick={sendMessage} disabled={!input.trim() || sending}>
                전송
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
