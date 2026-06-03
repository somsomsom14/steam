"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ProfileAvatar } from "@/components/dashboard/ProfileAvatar";
import { resolveAvatarUrl } from "@/lib/user-profile";

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

  // ── 프로필 편집 상태 ──────────────────────────────────────────────────────
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

  // ── 게임 데이터 갱신 상태 ─────────────────────────────────────────────────
  const [refreshStatus, setRefreshStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [refreshMsg, setRefreshMsg] = useState("");
  const [lastUpdated, setLastUpdated] = useState(gamesUpdatedAt);

  // ── 탈퇴 상태 ─────────────────────────────────────────────────────────────
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── 파일 선택 ─────────────────────────────────────────────────────────────
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

  // ── URL 입력으로 아바타 변경 ─────────────────────────────────────────────
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAvatarUrl(e.target.value);
    setAvatarFile(null);
    setAvatarPreview(e.target.value || currentAvatar);
    setAvatarError("");
  };

  // ── 프로필 저장 ───────────────────────────────────────────────────────────
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

  // ── 게임 데이터 갱신 ──────────────────────────────────────────────────────
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

  // ── 회원 탈퇴 ─────────────────────────────────────────────────────────────
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

  return (
    <div className="min-h-screen bg-bg px-4 py-12">
      <div className="mx-auto w-full max-w-[520px]">

        {/* 뒤로가기 */}
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="mb-8 flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-text-dim transition-colors hover:text-accent"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          대시보드로 돌아가기
        </button>

        {/* ── 상단: 프로필 요약 ────────────────────────────────────────────── */}
        <div className="mb-6 flex flex-col items-center gap-4 border border-[rgba(45,212,191,0.15)] bg-[#161a23] px-8 py-10">
          <div className="relative h-[100px] w-[100px] overflow-hidden rounded-full border-2 border-accent/40 bg-[#0f1117]">
            <ProfileAvatar
              src={avatarPreview}
              alt="프로필"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-text-main">{displayName}</p>
            <p className="mt-1 font-mono text-[0.65rem] text-text-dim/50">
              STEAM_ID: {steamId}
            </p>
            {lastUpdated && (
              <p className="mt-1 font-mono text-[0.6rem] text-text-dim/40">
                마지막 갱신: {formatDate(lastUpdated)}
              </p>
            )}
          </div>
        </div>

        {/* ── 중단: 프로필 편집 ────────────────────────────────────────────── */}
        <div className="mb-4 border border-[rgba(45,212,191,0.15)] bg-[#161a23] p-8">
          <p className="mb-6 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-accent">
            // PROFILE_EDIT
          </p>

          {/* 프로필 이미지 */}
          <div className="mb-7">
            <SectionLabel>프로필 이미지</SectionLabel>
            <div className="flex items-start gap-5">
              <div className="relative h-[72px] w-[72px] flex-shrink-0 overflow-hidden rounded-full border border-[rgba(45,212,191,0.3)] bg-[#0f1117]">
                <ProfileAvatar src={avatarPreview} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-fit border border-[rgba(45,212,191,0.3)] px-4 py-2 text-xs font-mono text-text-dim transition-colors hover:border-accent hover:text-accent"
                >
                  파일 선택
                </button>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[0.6rem] text-text-dim/40">또는</span>
                </div>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={handleUrlChange}
                  placeholder="이미지 URL 직접 입력"
                  className="w-full border border-[rgba(45,212,191,0.15)] bg-bg px-3 py-2 font-mono text-xs text-text-main placeholder-[rgba(160,168,184,0.3)] outline-none transition-colors focus:border-accent"
                />
                {avatarError && (
                  <p className="text-[0.65rem] text-red-400">{avatarError}</p>
                )}
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* 닉네임 */}
          <div className="mb-6">
            <SectionLabel>닉네임</SectionLabel>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={30}
              placeholder="사용할 닉네임을 입력하세요"
              className="w-full border border-[rgba(45,212,191,0.2)] bg-bg px-4 py-3 text-sm text-text-main placeholder-[rgba(160,168,184,0.4)] outline-none transition-colors focus:border-accent"
            />
            {steamNickname && (
              <button
                type="button"
                onClick={() => setNickname(steamNickname)}
                className="mt-2 text-[0.7rem] text-accent underline underline-offset-2 hover:no-underline"
              >
                Steam 닉네임 불러오기 ({steamNickname})
              </button>
            )}
          </div>

          {/* 성별 */}
          <div className="mb-8">
            <SectionLabel>성별</SectionLabel>
            <div className="flex gap-6">
              {(["male", "female", "private"] as Gender[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  className="flex items-center gap-2 focus:outline-none"
                >
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full border transition-colors ${gender === g ? "border-accent" : "border-[rgba(45,212,191,0.3)]"}`}>
                    {gender === g && <span className="h-2 w-2 rounded-full bg-accent" />}
                  </span>
                  <span className={`text-sm transition-colors ${gender === g ? "text-text-main" : "text-text-dim"}`}>
                    {GENDER_LABELS[g]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 저장 */}
          {saveStatus === "error" && (
            <p className="mb-3 text-xs text-red-400">{saveMsg}</p>
          )}
          {saveStatus === "done" && (
            <p className="mb-3 text-xs text-accent">{saveMsg}</p>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!nickname.trim() || saveStatus === "saving"}
            className="w-full bg-accent py-3.5 text-sm font-bold tracking-wide text-bg transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {saveStatus === "saving" ? "저장 중..." : "저장하기"}
          </button>
        </div>

        {/* ── 하단: 계정 관리 ──────────────────────────────────────────────── */}
        <div className="border border-[rgba(45,212,191,0.15)] bg-[#161a23] p-8">
          <p className="mb-6 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-accent">
            // ACCOUNT
          </p>

          {/* 게임 데이터 갱신 */}
          <div className="mb-6">
            <p className="mb-1 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-text-dim">
              게임 데이터 갱신
            </p>
            <p className="mb-4 text-xs leading-relaxed text-text-dim/50">
              Steam 라이브러리를 다시 불러와 최신 플레이 데이터로 갱신합니다.
              {lastUpdated
                ? ` 마지막 갱신: ${formatDate(lastUpdated)}`
                : " (아직 갱신된 적 없음)"}
            </p>
            {refreshMsg && (
              <p className={`mb-3 text-xs ${refreshStatus === "done" ? "text-accent" : "text-red-400"}`}>
                {refreshMsg}
              </p>
            )}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshStatus === "loading"}
              className="flex items-center gap-2 border border-[rgba(45,212,191,0.3)] px-5 py-3 text-sm font-mono text-text-dim transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
            >
              {refreshStatus === "loading" && (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border border-accent border-t-transparent" />
              )}
              {refreshStatus === "loading" ? "갱신 중..." : "게임 데이터 갱신"}
            </button>
          </div>

          <div className="mb-6 h-px bg-[rgba(255,255,255,0.06)]" />

          {/* 회원 탈퇴 */}
          <div>
            <p className="mb-1 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-text-dim">
              회원 탈퇴
            </p>
            <p className="mb-4 text-xs leading-relaxed text-text-dim/50">
              탈퇴 시 게임 데이터, 프로필 등 모든 정보가 영구적으로 삭제됩니다.
            </p>

            {!showConfirm ? (
              <button
                type="button"
                onClick={() => setShowConfirm(true)}
                className="border border-red-500/40 px-5 py-3 text-sm font-mono text-red-400 transition-colors hover:border-red-500 hover:bg-red-500/10"
              >
                탈퇴하기
              </button>
            ) : (
              <div className="border border-red-500/30 bg-red-500/5 p-5">
                <p className="mb-4 text-sm font-semibold text-red-400">
                  정말 탈퇴하시겠습니까?
                </p>
                <p className="mb-5 text-xs leading-relaxed text-text-dim/60">
                  모든 데이터(게임 분석, 프로필, 매칭 기록 등)가 즉시 삭제되며
                  복구할 수 없습니다.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="flex-1 bg-red-500 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {isDeleting ? "처리 중..." : "탈퇴 확인"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowConfirm(false)}
                    disabled={isDeleting}
                    className="flex-1 border border-[rgba(255,255,255,0.15)] py-3 text-sm font-mono text-text-dim transition-colors hover:text-text-main disabled:opacity-40"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-text-dim">
      {children}
    </p>
  );
}
