"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { ProfileAvatar } from "@/components/dashboard/ProfileAvatar";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { RoomChatEmojiPicker } from "@/components/rooms/RoomChatEmojiPicker";
import { RoomConfirmModal } from "@/components/rooms/RoomConfirmModal";
import "@/components/dashboard/dashboard.css";
import "../rooms.css";

/* ---- Types ---- */
type UserSnippet = {
  app_nickname: string | null;
  steam_nickname: string | null;
  app_avatar_url: string | null;
  steam_avatar_url: string | null;
};

type MessageType = "text" | "image";

type Message = {
  id: string;
  room_id: string;
  user_id: string;
  message: string;
  message_type?: MessageType | null;
  attachment_url?: string | null;
  created_at: string;
  user: UserSnippet | null;
};

type MemberRow = {
  role: "host" | "member";
  joined_at: string;
  user: ({ id: string } & UserSnippet) | null;
};

type ScheduleParticipant = {
  user_id: string;
  user: { app_nickname: string | null; steam_nickname: string | null } | null;
};

type Schedule = {
  id: string;
  room_id: string;
  creator_id: string;
  content: string;
  target_time: string;
  created_at: string;
  creator: { app_nickname: string | null; steam_nickname: string | null } | null;
  participants?: ScheduleParticipant[];
};

type Room = {
  id: string;
  title: string;
  subtitle: string | null;
  game_name: string;
  game_appid: number;
  game_thumbnail: string | null;
  host_id: string;
  notice: string | null;
  tags: string[];
};

type PresenceUser = { userId: string; nickname: string; avatar: string };

type Props = {
  room: Room;
  currentUserId: string;
  currentUser: { id: string; nickname: string; avatar: string };
  initialMembers: MemberRow[];
  initialMessages: Message[];
  initialSchedules: Schedule[];
};

const SCHEDULES_PER_PAGE = 3;

/* ---- Helpers ---- */
function nickOf(u: UserSnippet | null) {
  return u?.app_nickname || u?.steam_nickname || "알 수 없음";
}

function participantNick(p: ScheduleParticipant) {
  return p.user?.app_nickname || p.user?.steam_nickname || "알 수 없음";
}
function avatarOf(u: UserSnippet | null) {
  return u?.app_avatar_url || u?.steam_avatar_url || "";
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}
function fmtScheduleTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function isSchedulePast(targetTime: string, nowMs: number) {
  return new Date(targetTime).getTime() < nowMs;
}

function normalizeMessage(m: Message): Message {
  return {
    ...m,
    message_type: m.message_type === "image" ? "image" : "text",
    attachment_url: m.attachment_url ?? null,
  };
}

function isImageMessage(msg: Message) {
  return msg.message_type === "image" && !!msg.attachment_url;
}

function sortSchedulesDesc(list: Schedule[]) {
  return [...list].sort(
    (a, b) => new Date(b.target_time).getTime() - new Date(a.target_time).getTime()
  );
}

function Avatar({ src, size = 36 }: { src: string; size?: number }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="chat-msg__avatar" style={{ width: size, height: size }} />
  ) : (
    <div className="chat-msg__avatar" style={{ width: size, height: size, background: "#2a2d3e", borderRadius: "50%", flexShrink: 0 }} />
  );
}

/* ---- Main Component ---- */
export function RoomChatClient({ room, currentUserId, currentUser, initialMembers, initialMessages, initialSchedules }: Props) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [members, setMembers] = useState<MemberRow[]>(initialMembers);
  const [schedules, setSchedules] = useState<Schedule[]>(() => sortSchedulesDesc(initialSchedules));
  const [notice, setNotice] = useState(room.notice ?? "");
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [editingNotice, setEditingNotice] = useState(false);
  const [noticeInput, setNoticeInput] = useState(room.notice ?? "");

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [scheduleContent, setScheduleContent] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTimeOnly, setScheduleTimeOnly] = useState("");
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  const [participateLoading, setParticipateLoading] = useState<string | null>(null);
  const [expandedParticipantIds, setExpandedParticipantIds] = useState<Set<string>>(new Set());
  const [schedulePage, setSchedulePage] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(schedules.length / SCHEDULES_PER_PAGE) - 1);
    setSchedulePage((p) => (p > maxPage ? maxPage : p));
  }, [schedules.length]);

  const schedulePageCount = Math.max(1, Math.ceil(schedules.length / SCHEDULES_PER_PAGE));
  const pagedSchedules = schedules.slice(
    schedulePage * SCHEDULES_PER_PAGE,
    schedulePage * SCHEDULES_PER_PAGE + SCHEDULES_PER_PAGE
  );
  const showSchedulePager = schedules.length > SCHEDULES_PER_PAGE;

  const [roomTitle, setRoomTitle] = useState(room.title);
  const [roomSubtitle, setRoomSubtitle] = useState(room.subtitle ?? "");
  const [roomTags, setRoomTags] = useState<string[]>(Array.isArray(room.tags) ? room.tags : []);
  const [showHostSettings, setShowHostSettings] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<
    { type: "leave" } | { type: "kick"; userId: string } | { type: "delete" } | null
  >(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const userMap = useRef<Map<string, UserSnippet>>(new Map());

  const isHost = room.host_id === currentUserId;

  useEffect(() => {
    members.forEach((m) => { if (m.user?.id) userMap.current.set(m.user.id, m.user); });
  }, [members]);

  const scrollBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);
  useEffect(() => { scrollBottom(); }, [messages, scrollBottom]);

  /* ---- Realtime ---- */
  useEffect(() => {
    const channel = supabase.channel(`room:${room.id}`, { config: { presence: { key: currentUserId } } });

    channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${room.id}` }, (payload) => {
      const m = normalizeMessage(payload.new as Message);
      setMessages((prev) =>
        prev.some((x) => x.id === m.id) ? prev : [...prev, { ...m, user: userMap.current.get(m.user_id) ?? null }]
      );
    });

    channel.on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${room.id}` }, (payload) => {
      const u = payload.new as Room;
      setNotice(u.notice ?? "");
      setNoticeInput(u.notice ?? "");
    });

    channel.on("postgres_changes", { event: "DELETE", schema: "public", table: "rooms", filter: `id=eq.${room.id}` }, () => {
      router.push("/rooms");
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceUser>();
        setOnlineIds(new Set(Object.values(state).flat().map((p) => p.userId)));
      })
      .on("presence", { event: "join" }, ({ newPresences }) => {
        setOnlineIds((prev) => { const n = new Set(prev); newPresences.forEach((p: PresenceUser) => n.add(p.userId)); return n; });
      })
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        setOnlineIds((prev) => { const n = new Set(prev); leftPresences.forEach((p: PresenceUser) => n.delete(p.userId)); return n; });
      });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") await channel.track({ userId: currentUser.id, nickname: currentUser.nickname, avatar: currentUser.avatar });
    });

    return () => { supabase.removeChannel(channel); };
  }, [room.id, currentUserId, currentUser, supabase, router]);

  /* ---- Actions ---- */
  async function postMessage(payload: { message: string; message_type?: MessageType; attachment_url?: string }) {
    const res = await fetch(`/api/rooms/${room.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? "메시지 전송에 실패했습니다.");
    }
  }

  async function sendMessage() {
    const text = chatInput.trim();
    if (!text || sending || uploadingImage) return;
    setSending(true);
    setChatInput("");
    if (textareaRef.current) textareaRef.current.style.height = "24px";
    try {
      await postMessage({ message: text, message_type: "text" });
    } catch (err) {
      setChatInput(text);
      alert(err instanceof Error ? err.message : "메시지 전송에 실패했습니다.");
    } finally {
      setSending(false);
    }
  }

  function insertEmoji(emoji: string) {
    const ta = textareaRef.current;
    if (!ta) {
      setChatInput((prev) => prev + emoji);
      return;
    }
    const start = ta.selectionStart ?? chatInput.length;
    const end = ta.selectionEnd ?? chatInput.length;
    const next = chatInput.slice(0, start) + emoji + chatInput.slice(end);
    setChatInput(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + emoji.length;
      ta.selectionStart = pos;
      ta.selectionEnd = pos;
    });
  }

  async function handleImageUpload(file: File) {
    if (uploadingImage || sending) return;
    setUploadingImage(true);
    const caption = chatInput.trim();
    try {
      const formData = new FormData();
      formData.append("file", file);
      const upRes = await fetch(`/api/rooms/${room.id}/messages/upload`, { method: "POST", body: formData });
      if (!upRes.ok) {
        const data = (await upRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "이미지 업로드에 실패했습니다.");
      }
      const { url } = (await upRes.json()) as { url: string };
      await postMessage({
        message: caption,
        message_type: "image",
        attachment_url: url,
      });
      setChatInput("");
      if (textareaRef.current) textareaRef.current.style.height = "24px";
    } catch (err) {
      alert(err instanceof Error ? err.message : "이미지 전송에 실패했습니다.");
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleImageUpload(file);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setChatInput(e.target.value);
    const ta = e.target;
    ta.style.height = "24px";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }

  async function saveNotice() {
    await fetch(`/api/rooms/${room.id}/notice`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notice: noticeInput }) });
    setNotice(noticeInput);
    setEditingNotice(false);
  }

  async function kickMember(userId: string) {
    await fetch(`/api/rooms/${room.id}/members/${userId}`, { method: "DELETE" });
    setMembers((prev) => prev.filter((m) => m.user?.id !== userId));
  }

  async function leaveRoom() {
    await fetch(`/api/rooms/${room.id}/leave`, { method: "DELETE" });
    router.push("/rooms");
  }

  async function deleteRoom() {
    await fetch(`/api/rooms/${room.id}`, { method: "DELETE" });
    router.push("/rooms");
  }

  async function handleConfirmAction() {
    if (!confirmDialog || confirmLoading) return;
    setConfirmLoading(true);
    try {
      if (confirmDialog.type === "leave") {
        await leaveRoom();
      } else if (confirmDialog.type === "kick") {
        await kickMember(confirmDialog.userId);
        setConfirmDialog(null);
      } else if (confirmDialog.type === "delete") {
        setShowHostSettings(false);
        await deleteRoom();
      }
    } catch {
      setConfirmDialog(null);
    } finally {
      setConfirmLoading(false);
    }
  }

  async function saveRoomSettings() {
    if (!roomTitle.trim() || settingsSaving) return;
    setSettingsSaving(true);
    try {
      const res = await fetch(`/api/rooms/${room.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: roomTitle, subtitle: roomSubtitle, tags: roomTags }),
      });
      if (res.ok) {
        setShowHostSettings(false);
        router.refresh();
      }
    } finally {
      setSettingsSaving(false);
    }
  }

  function openScheduleModal() {
    setEditingScheduleId(null);
    setScheduleContent("");
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const iso = now.toISOString().slice(0, 16);
    setScheduleDate(iso.slice(0, 10));
    setScheduleTimeOnly(iso.slice(11, 16));
    setShowScheduleModal(true);
  }

  function openEditScheduleModal(schedule: Schedule) {
    setEditingScheduleId(schedule.id);
    setScheduleContent(schedule.content);
    const d = new Date(schedule.target_time);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    const iso = d.toISOString().slice(0, 16);
    setScheduleDate(iso.slice(0, 10));
    setScheduleTimeOnly(iso.slice(11, 16));
    setShowScheduleModal(true);
  }

  function closeScheduleModal() {
    setShowScheduleModal(false);
    setEditingScheduleId(null);
    setScheduleContent("");
    setScheduleDate("");
    setScheduleTimeOnly("");
  }

  async function saveSchedule() {
    if (!scheduleContent.trim() || !scheduleDate || !scheduleTimeOnly) return;
    setScheduleSubmitting(true);
    try {
      const targetIso = new Date(`${scheduleDate}T${scheduleTimeOnly}`).toISOString();
      const body = { content: scheduleContent, target_time: targetIso };

      if (editingScheduleId) {
        const res = await fetch(`/api/rooms/${room.id}/schedules`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scheduleId: editingScheduleId, ...body }),
        });
        if (res.ok) {
          const updated = (await res.json()) as Schedule;
          setSchedules((prev) =>
            sortSchedulesDesc(
              prev.map((s) =>
                s.id === updated.id ?
                  { ...updated, participants: s.participants ?? updated.participants ?? [] }
                : s
              )
            )
          );
          closeScheduleModal();
        }
      } else {
        const res = await fetch(`/api/rooms/${room.id}/schedules`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const created = (await res.json()) as Schedule;
          setSchedules((prev) =>
            sortSchedulesDesc([...prev, { ...created, participants: created.participants ?? [] }])
          );
          closeScheduleModal();
        }
      }
    } finally {
      setScheduleSubmitting(false);
    }
  }

  async function toggleParticipate(scheduleId: string) {
    if (participateLoading) return;
    setParticipateLoading(scheduleId);
    try {
      const res = await fetch(`/api/rooms/${room.id}/schedules/${scheduleId}/participate`, { method: "POST" });
      if (!res.ok) return;
      const { joined } = (await res.json()) as { joined: boolean };
      setSchedules((prev) =>
        prev.map((s) => {
          if (s.id !== scheduleId) return s;
          const parts = s.participants ?? [];
          if (joined) {
            if (parts.some((p) => p.user_id === currentUserId)) return s;
            return {
              ...s,
              participants: [
                ...parts,
                { user_id: currentUserId, user: { app_nickname: currentUser.nickname, steam_nickname: null } },
              ],
            };
          }
          return { ...s, participants: parts.filter((p) => p.user_id !== currentUserId) };
        })
      );
    } finally {
      setParticipateLoading(null);
    }
  }

  async function deleteSchedule(scheduleId: string) {
    await fetch(`/api/rooms/${room.id}/schedules`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scheduleId }) });
    setSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
    setExpandedParticipantIds((prev) => {
      const next = new Set(prev);
      next.delete(scheduleId);
      return next;
    });
  }

  function toggleParticipantList(scheduleId: string) {
    setExpandedParticipantIds((prev) => {
      const next = new Set(prev);
      if (next.has(scheduleId)) next.delete(scheduleId);
      else next.add(scheduleId);
      return next;
    });
  }


  return (
    <div className="dashboard-shell" style={{ height: "100vh", overflow: "hidden" }}>
      <DashboardSidebar activePath="/rooms" />

      <div className="dashboard-right" style={{ overflow: "hidden" }}>
        {/* Topbar */}
        <header className="dashboard-topbar">
          <Link href="/rooms" className="dashboard-mobile-logo" style={{ display: "flex", alignItems: "center", gap: "0.5rem", textDecoration: "none", color: "#111827", fontSize: "0.875rem", fontWeight: 600 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            방 목록
          </Link>

          {/* Room title + game */}
          <div style={{ flex: 1, marginLeft: "1rem" }}>
            <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{roomTitle}</div>
            <div style={{ fontSize: "0.72rem", color: "#828282" }}>{room.game_name}</div>
          </div>

          <a href="/profile" className="dashboard-topbar__profile" style={{ textDecoration: "none", cursor: "pointer" }}>
            <ProfileAvatar src={currentUser.avatar} alt="" className="dashboard-topbar__avatar" />
            <div className="dashboard-topbar__info">
              <div className="dashboard-topbar__name">{currentUser.nickname}</div>
              <svg className="dashboard-topbar__chevron" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5H7z" /></svg>
            </div>
          </a>
        </header>

        {/* Chat area — dark background */}
        <div className="dashboard-dark chat-room-body">
          {/* Members sidebar */}
          <aside className="chat-sidebar">
            <p className="chat-sidebar__section">멤버 ({members.length})</p>
            <div className="chat-sidebar__members-scroll">
            {members.map((m) => {
              const uid = m.user?.id;
              const name = nickOf(m.user);
              const avatar = avatarOf(m.user);
              const online = uid ? onlineIds.has(uid) : false;
              return (
                <div key={uid} className="chat-sidebar__member">
                  <div className="chat-sidebar__avatar-wrap">
                    {avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatar} alt="" className="chat-sidebar__avatar" />
                    ) : (
                      <div className="chat-sidebar__avatar" />
                    )}
                    {online && <span className="chat-sidebar__online-dot" />}
                  </div>
                  <span className="chat-sidebar__member-name">{name}</span>
                  {m.role === "host" && (
                    <svg className="chat-sidebar__crown" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M2 19l2-9 5 4 3-8 3 8 5-4 2 9H2z" />
                    </svg>
                  )}
                  {isHost && uid && uid !== currentUserId && (
                    <button type="button" className="chat-sidebar__kick-btn" onClick={() => setConfirmDialog({ type: "kick", userId: uid })} title="추방">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
              );
            })}
            </div>

            <div className="chat-sidebar__footer">
              {!isHost && (
                <button type="button" className="chat-sidebar__leave-btn" onClick={() => setConfirmDialog({ type: "leave" })}>
                  방 나가기
                </button>
              )}
              {isHost && (
                <button
                  type="button"
                  className="chat-sidebar__settings-open"
                  onClick={() => setShowHostSettings(true)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                  </svg>
                  방 설정
                </button>
              )}
            </div>
          </aside>

          {/* Main messages area */}
          <div className="chat-main">
            {/* Notice */}
            {(notice || isHost) && (
              <div className="chat-notice">
                <svg className="chat-notice__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
                {editingNotice ? (
                  <div className="chat-notice-edit-form">
                    <textarea rows={2} value={noticeInput} onChange={(e) => setNoticeInput(e.target.value)} placeholder="공지사항 입력..." />
                    <button type="button" className="chat-notice-save-btn" onClick={saveNotice}>저장</button>
                    <button type="button" className="chat-icon-btn" style={{ marginLeft: 0 }} onClick={() => { setEditingNotice(false); setNoticeInput(notice); }}>취소</button>
                  </div>
                ) : (
                  <>
                    <span className="chat-notice__text">{notice || "공지사항을 작성해 주세요."}</span>
                    {isHost && (
                      <button type="button" className="chat-notice__edit-btn" onClick={() => { setEditingNotice(true); setNoticeInput(notice); }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Messages */}
            <div className="chat-messages">
              {messages.map((msg, i) => {
                const prev = i > 0 ? messages[i - 1] : null;
                const isGrouped = prev?.user_id === msg.user_id && new Date(msg.created_at).getTime() - new Date(prev?.created_at ?? 0).getTime() < 5 * 60 * 1000;
                const isMine = msg.user_id === currentUserId;
                const hostMsg = msg.user_id === room.host_id;
                const name = nickOf(msg.user);
                const avatar = avatarOf(msg.user);
                return (
                  <div key={msg.id} className={`chat-msg${isGrouped ? " is-grouped" : ""}${isMine ? " is-mine" : ""}`}>
                    <Avatar src={avatar} size={36} />
                    <div className="chat-msg__content">
                      <div className="chat-msg__meta">
                        <span className={`chat-msg__name${hostMsg ? " is-host" : ""}`}>{name}{hostMsg && " 👑"}</span>
                        <span className="chat-msg__time">{fmtTime(msg.created_at)}</span>
                      </div>
                      {isImageMessage(msg) ? (
                        <div className="chat-msg__media">
                          <a
                            href={msg.attachment_url!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="chat-msg__image-link"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={msg.attachment_url!} alt="" className="chat-msg__image" loading="lazy" />
                          </a>
                          {msg.message.trim() && (
                            <p className="chat-msg__text chat-msg__text--caption">{msg.message}</p>
                          )}
                        </div>
                      ) : (
                        <p className="chat-msg__text">{msg.message}</p>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="chat-input-bar">
              <div className="chat-input-toolbar">
                <div className="chat-input-tools">
                  <button
                    type="button"
                    className="chat-input-tool-btn"
                    aria-label="이모지"
                    onClick={() => setEmojiOpen((v) => !v)}
                    disabled={sending || uploadingImage}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                      <line x1="9" y1="9" x2="9.01" y2="9" />
                      <line x1="15" y1="9" x2="15.01" y2="9" />
                    </svg>
                  </button>
                  <RoomChatEmojiPicker
                    open={emojiOpen}
                    onClose={() => setEmojiOpen(false)}
                    onPick={insertEmoji}
                  />
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="chat-input-file"
                    onChange={handleImagePick}
                  />
                  <button
                    type="button"
                    className="chat-input-tool-btn"
                    aria-label="사진 보내기"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={sending || uploadingImage}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                  </button>
                </div>
                <div className="chat-input-wrap">
                  <textarea
                    ref={textareaRef}
                    className="chat-input"
                    placeholder={
                      uploadingImage ? "이미지 업로드 중..." : `#${room.game_name} 채팅...`
                    }
                    value={chatInput}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    disabled={uploadingImage}
                  />
                  <button
                    type="button"
                    className="chat-send-btn"
                    onClick={sendMessage}
                    disabled={!chatInput.trim() || sending || uploadingImage}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Schedules panel */}
          <div className="chat-right">
            <div className="chat-right__header">
              <span className="chat-right__title">매칭 일정</span>
              <button type="button" className="chat-schedule-add-btn" onClick={openScheduleModal}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
                추가
              </button>
            </div>
            <div className="chat-schedules-body">
            <div className="chat-schedules-list">
              {schedules.length === 0 && (
                <p style={{ fontSize: "0.9rem", color: "#5c6b7d", textAlign: "center", paddingTop: "1rem" }}>예정된 일정이 없습니다.</p>
              )}
              {pagedSchedules.map((s) => {
                const canDelete = isHost || s.creator_id === currentUserId;
                const canEdit = s.creator_id === currentUserId;
                const creatorName = s.creator?.app_nickname || s.creator?.steam_nickname || "알 수 없음";
                const participants = s.participants ?? [];
                const isJoined = participants.some((p) => p.user_id === currentUserId);
                const isPast = isSchedulePast(s.target_time, nowMs);
                return (
                  <div key={s.id} className={`chat-schedule-card${isPast ? " is-past" : ""}`}>
                    {(canEdit || canDelete) && (
                      <div className="chat-schedule-card__actions">
                        {canEdit && (
                          <button type="button" className="chat-schedule-card__edit" onClick={() => openEditScheduleModal(s)}>
                            수정
                          </button>
                        )}
                        {canDelete && (
                          <button type="button" className="chat-schedule-card__del" onClick={() => deleteSchedule(s.id)} aria-label="삭제">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                          </button>
                        )}
                      </div>
                    )}
                    <div className="chat-schedule-card__time">{fmtScheduleTime(s.target_time)}</div>
                    <div className="chat-schedule-card__content">{s.content}</div>
                    <div className="chat-schedule-card__footer">
                      <div className="chat-schedule-card__creator">by {creatorName}</div>
                      <div className="chat-schedule-card__participate-wrap">
                        {participants.length > 0 && (
                          <span className="chat-schedule-card__count">{participants.length}명 참여</span>
                        )}
                        <button
                          type="button"
                          className={`chat-schedule-card__join${isJoined ? " chat-schedule-card__join--active" : ""}`}
                          onClick={() => toggleParticipate(s.id)}
                          disabled={participateLoading === s.id}
                        >
                          {isJoined ? "✓ 참여함" : "✓ 참여"}
                        </button>
                      </div>
                    </div>
                    {participants.length > 0 && (
                      <div className="chat-schedule-card__members-block">
                        <button
                          type="button"
                          className="chat-schedule-card__members-toggle"
                          onClick={() => toggleParticipantList(s.id)}
                          aria-expanded={expandedParticipantIds.has(s.id)}
                        >
                          멤버 보기
                          <span className="chat-schedule-card__members-chevron" aria-hidden>
                            {expandedParticipantIds.has(s.id) ? "▲" : "▼"}
                          </span>
                        </button>
                        {expandedParticipantIds.has(s.id) && (
                          <ul className="chat-schedule-card__members">
                            {participants.map((p) => (
                              <li key={p.user_id} className="chat-schedule-card__member">
                                {participantNick(p)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {showSchedulePager && (
              <div className="chat-schedules-pager">
                <button
                  type="button"
                  className="chat-schedules-pager__btn"
                  onClick={() => setSchedulePage((p) => Math.max(0, p - 1))}
                  disabled={schedulePage === 0}
                  aria-label="이전 일정"
                >
                  &lt;
                </button>
                <span className="chat-schedules-pager__info">
                  {schedulePage + 1} / {schedulePageCount}
                </span>
                <button
                  type="button"
                  className="chat-schedules-pager__btn"
                  onClick={() => setSchedulePage((p) => Math.min(schedulePageCount - 1, p + 1))}
                  disabled={schedulePage >= schedulePageCount - 1}
                  aria-label="다음 일정"
                >
                  &gt;
                </button>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* ---- Modals ---- */}
      {showScheduleModal && (
        <div className="chat-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeScheduleModal(); }}>
          <div className="chat-modal chat-modal--dashboard">
            <h3>{editingScheduleId ? "매칭 일정 수정" : "매칭 일정 추가"}</h3>
            <label className="chat-modal__label">
              내용
              <textarea
                rows={2}
                value={scheduleContent}
                onChange={(e) => setScheduleContent(e.target.value)}
                placeholder="예) 팀전 4명 모집"
              />
            </label>
            <div className="chat-modal__label">
              일시
              <div className="chat-datetime-row">
                <label className="chat-datetime-field">
                  <span className="chat-datetime-field__hint">날짜</span>
                  <input
                    type="date"
                    value={scheduleDate}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setScheduleDate(e.target.value)}
                  />
                </label>
                <label className="chat-datetime-field">
                  <span className="chat-datetime-field__hint">시간</span>
                  <input
                    type="time"
                    value={scheduleTimeOnly}
                    onChange={(e) => setScheduleTimeOnly(e.target.value)}
                  />
                </label>
              </div>
            </div>
            <div className="chat-modal__actions">
              <button type="button" className="chat-modal__cancel" onClick={closeScheduleModal}>취소</button>
              <button
                type="button"
                className="chat-modal__submit"
                onClick={saveSchedule}
                disabled={scheduleSubmitting || !scheduleContent.trim() || !scheduleDate || !scheduleTimeOnly}
              >
                {scheduleSubmitting ? "저장 중..." : editingScheduleId ? "수정" : "추가"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog && (
        <RoomConfirmModal
          title={
            confirmDialog.type === "leave"
              ? "방을 나가시겠습니까?"
              : confirmDialog.type === "kick"
                ? "이 멤버를 추방하시겠습니까?"
                : "방을 삭제하시겠습니까?"
          }
          description={
            confirmDialog.type === "leave"
              ? "나가면 이 방 채팅과 일정에 다시 참여하려면 재입장이 필요합니다."
              : confirmDialog.type === "delete"
                ? "삭제하면 채팅, 일정, 멤버 정보가 모두 사라지며 복구할 수 없습니다."
                : "추방된 멤버는 이 방에 다시 들어올 수 없습니다."
          }
          confirmLabel={
            confirmDialog.type === "leave"
              ? "나가기"
              : confirmDialog.type === "kick"
                ? "추방"
                : "삭제"
          }
          variant="danger"
          loading={confirmLoading}
          onConfirm={() => void handleConfirmAction()}
          onCancel={() => {
            if (!confirmLoading) setConfirmDialog(null);
          }}
        />
      )}

      {showHostSettings && (
        <div
          className="chat-modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setShowHostSettings(false); }}
        >
          <div className="chat-modal chat-modal--dashboard chat-modal--settings">
            <div className="chat-modal__header">
              <h3>방 설정</h3>
              <button type="button" className="chat-modal__close" onClick={() => setShowHostSettings(false)} aria-label="닫기">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <label className="chat-modal__label">
              방 이름
              <input
                value={roomTitle}
                onChange={(e) => setRoomTitle(e.target.value)}
                maxLength={60}
                placeholder="방 제목"
              />
            </label>
            <label className="chat-modal__label">
              한 줄 소개
              <input
                value={roomSubtitle}
                onChange={(e) => setRoomSubtitle(e.target.value)}
                maxLength={80}
                placeholder="간단한 설명"
              />
            </label>
            <label className="chat-modal__label">
              태그 (쉼표, 최대 3개)
              <input
                value={roomTags.join(", ")}
                onChange={(e) =>
                  setRoomTags(
                    e.target.value.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 3)
                  )
                }
                placeholder="초보환영, 친목"
              />
            </label>

            <p className="chat-modal__section-title">멤버 관리</p>
            <div className="chat-modal__members">
              {members
                .filter((m) => m.user?.id && m.user.id !== currentUserId)
                .map((m) => (
                  <div key={m.user!.id} className="chat-modal__member-row">
                    <span>{nickOf(m.user)}</span>
                    <button type="button" className="chat-modal__kick" onClick={() => setConfirmDialog({ type: "kick", userId: m.user!.id })}>
                      퇴출
                    </button>
                  </div>
                ))}
              {members.filter((m) => m.user?.id && m.user.id !== currentUserId).length === 0 && (
                <p className="chat-modal__members-empty">멤버가 없습니다.</p>
              )}
            </div>

            <div className="chat-modal__actions chat-modal__actions--split">
              <button type="button" className="chat-modal__danger" onClick={() => setConfirmDialog({ type: "delete" })}>
                방 삭제
              </button>
              <div className="chat-modal__actions-right">
                <button type="button" className="chat-modal__cancel" onClick={() => setShowHostSettings(false)}>취소</button>
                <button
                  type="button"
                  className="chat-modal__submit"
                  onClick={saveRoomSettings}
                  disabled={settingsSaving || !roomTitle.trim()}
                >
                  {settingsSaving ? "저장 중..." : "설정 저장"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
