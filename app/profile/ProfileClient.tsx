"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { ProfileAvatar } from "@/components/dashboard/ProfileAvatar";
import { resolveAvatarUrl } from "@/lib/user-profile";
import "@/components/dashboard/dashboard.css";

type Gender = "male" | "female" | "private";

type Props = {
  steamId: string;
  steamNickname: string;
  steamAvatarUrl: string;
  appNickname: string;
  appAvatarUrl: string;
  gender: Gender;
  gamesUpdatedAt: string | null;
};

const GENDER_LABELS: Record<Gender, string> = {
  male: "남성",
  female: "여성",
  private: "비공개",
};

const A = "#2dd4bf";
const A20 = "rgba(45,212,191,0.2)";
const A30 = "rgba(45,212,191,0.3)";

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ProfileClient({
  steamId,
  steamNickname,
  steamAvatarUrl,
  appNickname,
  appAvatarUrl,
  gender: initialGender,
  gamesUpdatedAt,
}: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const displayName = appNickname || steamNickname || "게이머";
  const currentAvatar = resolveAvatarUrl(
    { app_avatar_url: appAvatarUrl, steam_avatar_url: steamAvatarUrl },
    ""
  );

  const [nickname, setNickname] = useState(appNickname || steamNickname);
  const [gender, setGender] = useState<Gender>(initialGender);
  const [savedAvatarUrl, setSavedAvatarUrl] = useState(appAvatarUrl);
  const [avatarPreview, setAvatarPreview] = useState(
    appAvatarUrl || currentAvatar || ""
  );
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarError, setAvatarError] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [saveMsg, setSaveMsg] = useState("");

  const [refreshStatus, setRefreshStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [refreshMsg, setRefreshMsg] = useState("");
  const [lastUpdated, setLastUpdated] = useState(gamesUpdatedAt);

  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setAvatarError("jpg, jpeg, png, webp 형식만 허용됩니다.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("최대 5MB까지 업로드 가능합니다.");
      return;
    }
    setAvatarError("");
    setAvatarFile(file);
    setAvatarUrl("");
    setAvatarPreview(URL.createObjectURL(file));
    e.target.value = "";
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAvatarUrl(e.target.value);
    setAvatarFile(null);
    setAvatarPreview(e.target.value || currentAvatar);
    setAvatarError("");
  };

  const handleSave = async () => {
    if (!nickname.trim() || saveStatus === "saving") return;
    setSaveStatus("saving");
    setSaveMsg("");

    let finalAvatarUrl: string | null =
      savedAvatarUrl?.trim() || appAvatarUrl?.trim() || steamAvatarUrl?.trim() || null;

    if (avatarFile) {
      const fd = new FormData();
      fd.append("file", avatarFile);
      const uploadRes = await fetch("/api/user/avatar", { method: "POST", body: fd });
      const uploadData = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) {
        setSaveStatus("error");
        setSaveMsg(uploadData.error ?? "프로필 이미지 업로드에 실패했습니다.");
        setTimeout(() => setSaveStatus("idle"), 4000);
        return;
      }
      finalAvatarUrl = uploadData.url ?? finalAvatarUrl;
    } else if (avatarUrl.trim()) {
      finalAvatarUrl = avatarUrl.trim();
    }

    const res = await fetch("/api/user/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_nickname: nickname.trim(),
        app_avatar_url: finalAvatarUrl,
        gender,
      }),
    });

    if (res.ok) {
      setSavedAvatarUrl(finalAvatarUrl ?? "");
      setAvatarPreview(finalAvatarUrl ?? "");
      setAvatarFile(null);
      setAvatarUrl("");
      setSaveStatus("done");
      setSaveMsg("저장 완료");
      router.refresh();
      setTimeout(() => setSaveStatus("idle"), 2500);
    } else {
      const data = await res.json().catch(() => ({}));
      setSaveStatus("error");
      setSaveMsg(data.error ?? "저장에 실패했습니다.");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  const handleRefresh = async () => {
    if (refreshStatus === "loading") return;
    setRefreshStatus("loading");
    setRefreshMsg("");

    try {
      const res = await fetch("/api/steam/sync", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        const now = new Date().toISOString();
        setLastUpdated(now);
        setRefreshStatus("done");
        setRefreshMsg(`갱신 완료 — ${data.saved}개 게임`);
        setTimeout(() => setRefreshStatus("idle"), 3000);
      } else {
        setRefreshStatus("error");
        setRefreshMsg("갱신 중 오류가 발생했습니다.");
        setTimeout(() => setRefreshStatus("idle"), 3000);
      }
    } catch {
      setRefreshStatus("error");
      setRefreshMsg("네트워크 오류가 발생했습니다.");
      setTimeout(() => setRefreshStatus("idle"), 3000);
    }
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.push("/");
  };

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);

    const res = await fetch("/api/user/delete", { method: "DELETE" }).catch(() => null);
    if (res?.ok) {
      router.push("/");
    } else {
      setIsDeleting(false);
      setShowConfirm(false);
      alert("탈퇴 처리 중 오류가 발생했습니다. 다시 시도해주세요.");
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#0b0e14",
    border: `1px solid ${A20}`,
    borderRadius: 0,
    padding: "11px 14px",
    fontSize: "0.875rem",
    color: "#e2e8f0",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
    fontFamily: "inherit",
  };

  const topbarAvatar = resolveAvatarUrl(
    {
      app_avatar_url: avatarPreview || savedAvatarUrl || appAvatarUrl,
      steam_avatar_url: steamAvatarUrl,
    },
    ""
  );

  return (
    <div
      className="dashboard-shell"
      style={{ color: "#e2e8f0", fontFamily: "Inter, -apple-system, sans-serif" }}
    >
      <DashboardSidebar activePath="/dashboard" />

      <div className="dashboard-right">
        <header className="dashboard-topbar">
          <a href="/dashboard" className="dashboard-mobile-logo">
            MI-TEAM
          </a>
          <a
            href="/profile"
            className="dashboard-topbar__profile"
            style={{ textDecoration: "none", cursor: "pointer" }}
          >
            <ProfileAvatar src={topbarAvatar} alt="" className="dashboard-topbar__avatar" />
            <div className="dashboard-topbar__info">
              <div className="dashboard-topbar__name">{displayName}</div>
              <div className="dashboard-topbar__id">
                ID: <strong>{steamId.slice(-7)}</strong>
              </div>
              <svg
                className="dashboard-topbar__chevron"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M7 10l5 5 5-5H7z" />
              </svg>
            </div>
          </a>
        </header>

        <div className="dashboard-dark profile-page">
          <div className="profile-page__inner">
            <div className="profile-layout">
              <div className="profile-card profile-card--main">
          <div style={{ marginBottom: 20 }}>
            <h1
              style={{
                fontSize: "1.6rem",
                fontWeight: 700,
                marginBottom: 8,
                letterSpacing: "-0.02em",
                color: "#e2e8f0",
              }}
            >
              프로필 설정
            </h1>
            <p style={{ color: "#a0a8b8", fontSize: "0.85rem", lineHeight: 1.6 }}>
              <strong style={{ color: "#e2e8f0", fontWeight: 600 }}>{displayName}</strong>
              님의 닉네임과 프로필을 관리합니다.
            </p>
            <p
              style={{
                marginTop: 8,
                fontSize: "0.72rem",
                color: "rgba(160,168,184,0.45)",
                fontFamily: "monospace",
              }}
            >
              STEAM · {steamId}
              {lastUpdated && ` · 갱신 ${formatDate(lastUpdated)}`}
            </p>
          </div>

          {/* 프로필 편집 */}
          <div className="flex flex-col" style={{ gap: 16 }}>
            <div>
              <FieldLabel>프로필 이미지</FieldLabel>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div
                  style={{
                    width: 72,
                    height: 72,
                    flexShrink: 0,
                    border: `1px solid ${A20}`,
                    background: "#0b0e14",
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ProfileAvatar
                    src={avatarPreview}
                    alt="프로필"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    style={{
                      background: "transparent",
                      border: `1px solid ${A20}`,
                      color: "#e2e8f0",
                      padding: "7px 16px",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      fontFamily: "inherit",
                      width: "fit-content",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = A;
                      e.currentTarget.style.color = A;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = A20;
                      e.currentTarget.style.color = "#e2e8f0";
                    }}
                  >
                    이미지 변경
                  </button>
                  <p style={{ fontSize: "0.68rem", color: "rgba(160,168,184,0.4)", margin: 0 }}>
                    jpg · png · webp · 최대 5MB
                  </p>
                </div>
              </div>
              <input
                type="url"
                value={avatarUrl}
                onChange={handleUrlChange}
                placeholder="또는 이미지 URL 직접 입력"
                style={{ ...inputStyle, marginTop: 12 }}
                onFocus={(e) => (e.currentTarget.style.borderColor = A)}
                onBlur={(e) => (e.currentTarget.style.borderColor = A20)}
              />
              {avatarError && (
                <p style={{ marginTop: 6, fontSize: "0.75rem", color: "rgba(255,100,100,0.85)" }}>
                  {avatarError}
                </p>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
            </div>

            <div>
              <FieldLabel>닉네임</FieldLabel>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={30}
                placeholder="사용할 닉네임을 입력하세요"
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = A)}
                onBlur={(e) => (e.currentTarget.style.borderColor = A20)}
              />
              {steamNickname && (
                <div
                  style={{
                    marginTop: 6,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: "0.72rem", color: "rgba(160,168,184,0.5)" }}>
                    Steam: {steamNickname}
                  </span>
                  <button
                    type="button"
                    onClick={() => setNickname(steamNickname)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "rgba(224,232,240,0.7)",
                      fontSize: "0.72rem",
                      cursor: "pointer",
                      textDecoration: "underline",
                      fontFamily: "inherit",
                    }}
                  >
                    불러오기
                  </button>
                </div>
              )}
            </div>

            <div>
              <FieldLabel>성별</FieldLabel>
              <div style={{ display: "flex", gap: 20 }}>
                {(["male", "female", "private"] as Gender[]).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        border: `1px solid ${gender === g ? "rgba(224,232,240,0.8)" : A20}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "border-color 0.15s",
                      }}
                    >
                      {gender === g && (
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: "#e2e8f0",
                          }}
                        />
                      )}
                    </span>
                    <span
                      style={{
                        fontSize: "0.85rem",
                        color: gender === g ? "#e2e8f0" : "#a0a8b8",
                        fontFamily: "inherit",
                      }}
                    >
                      {GENDER_LABELS[g]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {saveStatus === "error" && (
              <p style={{ fontSize: "0.78rem", color: "rgba(255,100,100,0.85)" }}>{saveMsg}</p>
            )}
            {saveStatus === "done" && (
              <p style={{ fontSize: "0.78rem", color: A }}>{saveMsg}</p>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={!nickname.trim() || saveStatus === "saving"}
              className="w-full flex items-center justify-center gap-2"
              style={{
                background: A,
                color: "#050505",
                fontWeight: 700,
                borderRadius: 8,
                padding: "12px 0",
                fontSize: "0.9rem",
                border: "none",
                cursor: nickname.trim() && saveStatus !== "saving" ? "pointer" : "not-allowed",
                opacity: nickname.trim() && saveStatus !== "saving" ? 1 : 0.35,
                transition: "all 0.2s",
              }}
            >
              {saveStatus === "saving" ? "저장 중..." : "저장하기"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="w-full"
              style={{
                marginTop: 10,
                background: "transparent",
                border: `1px solid ${A20}`,
                color: "#a0a8b8",
                borderRadius: 8,
                padding: "12px 0",
                fontSize: "0.85rem",
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = A30;
                e.currentTarget.style.color = "#e2e8f0";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = A20;
                e.currentTarget.style.color = "#a0a8b8";
              }}
            >
              나가기
            </button>
          </div>
              </div>

              <aside className="profile-card profile-card--account">
                <h2 className="profile-account__title">계정 관리</h2>
                <p className="profile-account__hint">
                  Steam 라이브러리를 다시 불러와 최신 플레이 데이터로 갱신합니다.
                </p>

                {refreshMsg && (
                  <p
                    className={`profile-account__msg ${refreshStatus === "done" ? "is-ok" : "is-error"}`}
                  >
                    {refreshMsg}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={refreshStatus === "loading"}
                  className="profile-account__btn"
                >
                  {refreshStatus === "loading" ? "갱신 중..." : "게임 데이터 갱신"}
                </button>

                <div className="profile-account__divider" />

                <p className="profile-account__section-label">로그아웃</p>
                <p className="profile-account__hint">
                  현재 계정에서 로그아웃합니다. 다시 Steam으로 로그인할 수 있습니다.
                </p>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="profile-account__btn"
                >
                  {isLoggingOut ? "로그아웃 중..." : "로그아웃"}
                </button>

                <div className="profile-account__bottom">
                <div className="profile-account__divider" />

                <p className="profile-account__section-label">회원 탈퇴</p>
                <p className="profile-account__hint">
                  탈퇴 시 게임 데이터, 프로필 등 모든 정보가 영구적으로 삭제됩니다.
                </p>

                {!showConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowConfirm(true)}
                    className="profile-account__btn profile-account__btn--danger"
                  >
                    회원 탈퇴
                  </button>
                ) : (
                  <div className="profile-account__confirm">
                    <p>정말 탈퇴하시겠습니까?</p>
                    <p>모든 데이터가 삭제되며 복구할 수 없습니다.</p>
                    <div className="profile-account__confirm-actions">
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="profile-account__btn profile-account__btn--danger"
                      >
                        {isDeleting ? "처리 중..." : "탈퇴 확인"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowConfirm(false)}
                        disabled={isDeleting}
                        className="profile-account__btn"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                )}
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        marginBottom: 8,
        fontSize: "0.7rem",
        fontWeight: 500,
        color: "rgba(160,168,184,0.6)",
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        fontFamily: "inherit",
      }}
    >
      {children}
    </p>
  );
}
