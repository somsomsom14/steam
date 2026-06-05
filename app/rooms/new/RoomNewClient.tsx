"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ProfileAvatar } from "@/components/dashboard/ProfileAvatar";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import "@/components/dashboard/dashboard.css";
import "../rooms.css";

const PRESET_TAGS = ["초보환영", "음성채팅", "빡겜", "친목", "캐주얼"];

type Game = { appid: number; game_name: string };

type Props = {
  games: Game[];
  displayName: string;
  avatarUrl: string;
  steamId: string;
};

export function RoomNewClient({ games, displayName, avatarUrl, steamId }: Props) {
  const router = useRouter();
  const [selectedAppid, setSelectedAppid] = useState<number | "">("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const selectedGame = games.find((g) => g.appid === Number(selectedAppid));
  const thumbUrl = selectedAppid ? `https://cdn.akamai.steamstatic.com/steam/apps/${selectedAppid}/header.jpg` : null;

  function toggleTag(t: string) {
    if (tags.includes(t)) {
      setTags(tags.filter((x) => x !== t));
    } else if (tags.length < 3) {
      setTags([...tags, t]);
    }
  }

  function addCustomTag() {
    const t = tagInput.trim();
    if (!t || tags.includes(t) || tags.length >= 3) return;
    setTags([...tags, t]);
    setTagInput("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGame || !title.trim()) {
      setError("게임과 방 제목을 입력해 주세요.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          subtitle: subtitle.trim() || null,
          game_name: selectedGame.game_name,
          game_appid: selectedGame.appid,
          game_thumbnail: thumbUrl,
          tags,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "오류가 발생했습니다."); return; }
      router.push(`/rooms/${data.id}`);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="dashboard-shell">
      <DashboardSidebar activePath="/rooms" />

      <div className="dashboard-right">
        {/* Topbar */}
        <header className="dashboard-topbar">
          <a href="/dashboard" className="dashboard-mobile-logo">MI-TEAM</a>
          <a href="/profile" className="dashboard-topbar__profile" style={{ textDecoration: "none", cursor: "pointer" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <ProfileAvatar src={avatarUrl} alt="" className="dashboard-topbar__avatar" />
            <div className="dashboard-topbar__info">
              <div className="dashboard-topbar__name">{displayName}</div>
              <div className="dashboard-topbar__id">ID: <strong>{steamId.slice(-7)}</strong></div>
              <svg className="dashboard-topbar__chevron" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 10l5 5 5-5H7z" />
              </svg>
            </div>
          </a>
        </header>

        {/* Content */}
        <div className="dashboard-dark" style={{ flex: 1, overflowY: "auto" }}>
          <div className="room-new-main" style={{ maxWidth: 640, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "2rem" }}>
              <Link href="/rooms" style={{ color: "var(--text-dim)", display: "flex", alignItems: "center", textDecoration: "none" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
              </Link>
              <h1 className="room-new-heading" style={{ margin: 0 }}>방 만들기</h1>
            </div>
            <form className="room-new-form" onSubmit={handleSubmit}>
              {/* 게임 선택 */}
              <div className="room-new-field">
                <label className="room-new-label">게임 선택 <span>*</span></label>
                <select
                  className="room-new-select"
                  value={selectedAppid}
                  onChange={(e) => setSelectedAppid(e.target.value === "" ? "" : Number(e.target.value))}
                >
                  <option value="">게임을 선택하세요</option>
                  {games.map((g) => (
                    <option key={g.appid} value={g.appid}>{g.game_name}</option>
                  ))}
                </select>
                {thumbUrl && (
                  <div className="room-new-thumb-preview">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumbUrl} alt={selectedGame?.game_name} />
                  </div>
                )}
              </div>

              {/* 방 제목 */}
              <div className="room-new-field">
                <label className="room-new-label">방 제목 <span>*</span></label>
                <input
                  className="room-new-input"
                  placeholder="예) 같이 달리실 분 구해요"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={60}
                />
              </div>

              {/* 부제목 */}
              <div className="room-new-field">
                <label className="room-new-label">한 줄 소개</label>
                <input
                  className="room-new-input"
                  placeholder="방에 대한 간단한 소개 (선택)"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  maxLength={80}
                />
              </div>

              {/* 태그 */}
              <div className="room-new-field">
                <label className="room-new-label">플레이 스타일 태그 (최대 3개)</label>
                <div className="room-new-tags-preset">
                  {PRESET_TAGS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`room-new-tag-chip${tags.includes(t) ? " is-active" : ""}`}
                      onClick={() => toggleTag(t)}
                      disabled={!tags.includes(t) && tags.length >= 3}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div className="room-new-tag-input-row">
                  <input
                    className="room-new-input"
                    placeholder="직접 입력"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomTag(); } }}
                    maxLength={20}
                  />
                  <button type="button" className="room-new-tag-add-btn" onClick={addCustomTag} disabled={tags.length >= 3}>추가</button>
                </div>
                {tags.length > 0 && (
                  <div className="room-new-selected-tags">
                    {tags.map((t) => (
                      <span key={t} className="room-new-selected-tag">
                        {t}
                        <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {error && <div className="room-new-error">{error}</div>}

              <button type="submit" className="room-new-submit-btn" disabled={submitting}>
                {submitting ? "생성 중..." : "방 만들기"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
