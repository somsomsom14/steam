"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ProfileAvatar } from "@/components/dashboard/ProfileAvatar";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { RoomsHeroGridScene } from "@/components/rooms/RoomsHeroGridScene";
import "@/components/dashboard/dashboard.css";
import "./rooms.css";

type RoomRow = {
  id: string;
  title: string;
  subtitle: string | null;
  game_name: string;
  game_appid: number;
  game_thumbnail: string | null;
  host_id: string;
  tags: string[];
  created_at: string;
  host: { app_nickname: string | null; steam_nickname: string | null; app_avatar_url: string | null; steam_avatar_url: string | null } | null;
  room_members: { count: number }[];
};

function RoomCard({ room }: { room: RoomRow }) {
  const thumb = room.game_thumbnail || `https://cdn.akamai.steamstatic.com/steam/apps/${room.game_appid}/header.jpg`;
  const hostName = room.host?.app_nickname || room.host?.steam_nickname || "알 수 없음";
  const hostAvatar = room.host?.app_avatar_url || room.host?.steam_avatar_url || "";
  const memberCount = room.room_members?.[0]?.count ?? 0;
  const tags: string[] = Array.isArray(room.tags) ? room.tags : [];

  return (
    <Link href={`/rooms/${room.id}`} className="room-card">
      <div className="room-card__thumb">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumb} alt={room.game_name} />
        <span className="room-card__game-badge">{room.game_name}</span>
      </div>
      <div className="room-card__body">
        <h3 className="room-card__title">{room.title}</h3>
        {room.subtitle && <p className="room-card__subtitle">{room.subtitle}</p>}
        <div className="room-card__meta">
          <div className="room-card__host">
            {hostAvatar && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={hostAvatar} alt="" className="room-card__host-avatar" />
            )}
            <span>{hostName}</span>
          </div>
          <div className="room-card__members">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
            <span>{memberCount}</span>
          </div>
        </div>
        {tags.length > 0 && (
          <div className="room-card__tags">
            {tags.map((t) => <span key={t} className="room-card__tag">{t}</span>)}
          </div>
        )}
      </div>
    </Link>
  );
}

type Props = {
  initialRooms: RoomRow[];
  displayName: string;
  avatarUrl: string;
  steamId: string;
};

export function RoomsClient({ initialRooms, displayName, avatarUrl, steamId }: Props) {
  const [rooms, setRooms] = useState<RoomRow[]>(initialRooms);
  const [titleQuery, setTitleQuery] = useState("");
  const [gameQuery, setGameQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchRooms = useCallback(async (title: string, game: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (title.trim()) params.set("title", title.trim());
      if (game.trim()) params.set("game", game.trim());
      const qs = params.toString();
      const res = await fetch(qs ? `/api/rooms?${qs}` : "/api/rooms");
      if (res.ok) setRooms(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  const runSearch = useCallback(() => {
    void fetchRooms(titleQuery, gameQuery);
  }, [titleQuery, gameQuery, fetchRooms]);

  const clearSearch = useCallback(() => {
    setTitleQuery("");
    setGameQuery("");
    void fetchRooms("", "");
  }, [fetchRooms]);

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
        <div className="dashboard-dark rooms-page" style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
          <header className="rooms-hero">
            <RoomsHeroGridScene />
            <div className="rooms-hero__inner">
              <div className="rooms-hero__center">
                <div className="rooms-hero__tagline">
                  <p>게임을 선택하고,</p>
                  <p>함께할 팀원을 만나보세요</p>
                </div>
                <Link href="/rooms/new" className="rooms-create-btn rooms-create-btn--hero">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  방 만들기
                </Link>
              </div>
            </div>
          </header>

          <div className="rooms-search-bar">
            <div className="rooms-search-bar__filters">
              <form
                className="rooms-filter-group"
                onSubmit={(e) => {
                  e.preventDefault();
                  runSearch();
                }}
              >
                <span className="rooms-filter-group__label">게임</span>
                <input
                  className="rooms-search"
                  placeholder="게임명"
                  value={gameQuery}
                  onChange={(e) => setGameQuery(e.target.value)}
                />
                <button type="submit" className="rooms-btn rooms-btn--primary" disabled={loading}>
                  검색
                </button>
              </form>

              <form
                className="rooms-filter-group"
                onSubmit={(e) => {
                  e.preventDefault();
                  runSearch();
                }}
              >
                <span className="rooms-filter-group__label">방 제목</span>
                <input
                  className="rooms-search"
                  placeholder="방 이름"
                  value={titleQuery}
                  onChange={(e) => setTitleQuery(e.target.value)}
                />
                <button type="submit" className="rooms-btn rooms-btn--primary" disabled={loading}>
                  검색
                </button>
              </form>

              {(titleQuery || gameQuery) && (
                <button
                  type="button"
                  className="rooms-btn rooms-btn--ghost"
                  onClick={clearSearch}
                  disabled={loading}
                >
                  초기화
                </button>
              )}
            </div>
          </div>

          {!loading && rooms.length === 0 && (
            <div className="rooms-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
                <rect x="3" y="5" width="18" height="12" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
              <p>방이 없습니다.</p>
              <p className="rooms-empty__sub">
                <Link href="/rooms/new">첫 번째로 만들어보세요!</Link>
              </p>
            </div>
          )}

          {!loading && rooms.length > 0 && (
            <div className="rooms-grid">
              {rooms.map((room) => <RoomCard key={room.id} room={room} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
