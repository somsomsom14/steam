"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ProfileAvatar } from "@/components/dashboard/ProfileAvatar";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
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
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRooms = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/rooms?q=${encodeURIComponent(q)}`);
      if (res.ok) setRooms(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchRooms(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, fetchRooms]);

  return (
    <div className="dashboard-shell">
      <DashboardSidebar activePath="/rooms" />

      <div className="dashboard-right">
        {/* Topbar */}
        <header className="dashboard-topbar">
          <a href="/" className="dashboard-mobile-logo">MI-TEAM</a>
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
          <div className="rooms-top">
            <div className="rooms-search-wrap">
              <svg className="rooms-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" /><path d="M20 20l-3-3" />
              </svg>
              <input
                className="rooms-search"
                placeholder="게임명으로 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Link href="/rooms/new" className="rooms-create-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
              방 만들기
            </Link>
          </div>

          {loading && <div className="rooms-loading">검색 중...</div>}

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
