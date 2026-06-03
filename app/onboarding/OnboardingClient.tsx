"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  steamNickname: string;
  steamAvatarUrl: string;
};

type SyncStatus = "idle" | "syncing" | "done" | "error";
type Gender = "male" | "female" | "private";

const GENDER_LABELS: Record<Gender, string> = {
  male: "남성",
  female: "여성",
  private: "비공개",
};

export function OnboardingClient({ steamNickname, steamAvatarUrl }: Props) {
  const router = useRouter();

  // ── 공통 ─────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2>(1);

  // ── Step 1 ────────────────────────────────────────────────────────────────
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncCount, setSyncCount] = useState(0);
  const [syncTotal, setSyncTotal] = useState(0);
  const [syncMissing, setSyncMissing] = useState<{ appid: number; name: string }[]>([]);

  // ── Step 2 ────────────────────────────────────────────────────────────────
  const [nickname, setNickname] = useState("");
  const [gender, setGender] = useState<Gender>("private");
  const [avatarPreview, setAvatarPreview] = useState<string>(steamAvatarUrl);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarError, setAvatarError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── 핸들러: 분석하고 시작하기 ─────────────────────────────────────────────
  const handleAgree = async () => {
    setSyncStatus("syncing");

    await fetch("/api/user/agree", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agreed: true }),
    }).catch(() => {});

    try {
      const res = await fetch("/api/steam/sync", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setSyncCount(data.saved ?? 0);
        setSyncTotal(data.total ?? 0);
        setSyncMissing(data.missing ?? []);
        setSyncStatus("done");
        // 누락 없으면 2초 후 자동 이동, 누락 있으면 사용자가 직접 확인 후 이동
        if (!data.missing?.length) {
          setTimeout(() => setStep(2), 2000);
        }
      } else {
        setSyncStatus("error");
      }
    } catch {
      setSyncStatus("error");
    }
  };

  // ── 핸들러: 나중에 하기 ───────────────────────────────────────────────────
  const handleSkip = async () => {
    await fetch("/api/user/agree", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agreed: false }),
    }).catch(() => {});
    setStep(2);
  };

  // ── 핸들러: 파일 선택 ─────────────────────────────────────────────────────
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
    setAvatarPreview(URL.createObjectURL(file));
    // 같은 파일 재선택 허용
    e.target.value = "";
  };

  // ── 핸들러: 시작하기 ──────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!nickname.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError("");

    let avatarUrl: string | null = steamAvatarUrl || null;

    if (avatarFile) {
      const formData = new FormData();
      formData.append("file", avatarFile);
      const uploadRes = await fetch("/api/user/avatar", {
        method: "POST",
        body: formData,
      }).catch(() => null);

      if (uploadRes?.ok) {
        const uploadData = await uploadRes.json();
        avatarUrl = uploadData.url ?? avatarUrl;
      }
    }

    const res = await fetch("/api/user/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_nickname: nickname.trim(),
        app_avatar_url: avatarUrl,
        gender,
      }),
    });

    if (res.ok) {
      router.push("/dashboard");
    } else {
      const data = await res.json().catch(() => ({}));
      setSubmitError(data.error ?? "저장에 실패했습니다. 다시 시도해주세요.");
      setIsSubmitting(false);
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // Step 1: 데이터 분석 동의
  // ════════════════════════════════════════════════════════════════════════════
  if (step === 1) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4 py-12">
        <div className="w-full max-w-[500px]">
          {/* 스텝 인디케이터 */}
          <StepIndicator current={1} />

          <div className="border border-[rgba(45,212,191,0.2)] bg-[#161a23] p-8 sm:p-10">
            {/* 상단 레이블 */}
            <p className="mb-6 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-accent">
              // STEP_01 — DATA_CONSENT
            </p>

            {/* 동의 화면 */}
            {syncStatus === "idle" && (
              <>
                <h2 className="mb-5 text-lg font-bold leading-relaxed text-text-main break-keep">
                  Steam 계정 연동이 완료되었습니다.
                </h2>
                <p className="mb-8 text-sm leading-[1.85] text-text-dim break-keep">
                  보유 게임과 플레이 기록을 분석하여 나와 게임 취향이 비슷한
                  플레이어와 게임을 추천해드립니다.
                  <br />
                  <br />
                  분석된 데이터는 본 사이트의 기능에만 사용되며, 다른 용도로
                  사용되거나 외부에 공개되지 않습니다.
                </p>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleAgree}
                    className="w-full bg-accent py-4 text-sm font-bold tracking-wide text-bg transition-opacity hover:opacity-90"
                  >
                    분석하고 시작하기
                  </button>
                  <button
                    onClick={handleSkip}
                    className="w-full border border-[rgba(45,212,191,0.25)] py-4 text-sm font-medium text-text-dim transition-colors hover:border-accent hover:text-text-main"
                  >
                    나중에 하기
                  </button>
                </div>
              </>
            )}

            {/* 동기화 중 */}
            {syncStatus === "syncing" && (
              <div className="flex flex-col items-center gap-6 py-6">
                <div className="h-9 w-9 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                <div className="text-center">
                  <p className="font-mono text-sm text-text-main">
                    Steam 게임 데이터 동기화 중...
                  </p>
                  <p className="mt-2 font-mono text-xs text-text-dim/60">
                    보유 게임 수에 따라 최대 1분 소요됩니다.
                  </p>
                </div>
              </div>
            )}

            {/* 동기화 완료 */}
            {syncStatus === "done" && (
              <div className="flex flex-col gap-4 py-2">
                <span className="font-mono text-[0.65rem] uppercase tracking-widest text-accent">
                  // SYNC_COMPLETE
                </span>

                {/* 저장 결과 */}
                <div className="flex items-baseline gap-2">
                  <span className="text-[2rem] font-black text-text-main tabular-nums">
                    {syncCount}
                  </span>
                  <span className="text-sm text-text-dim">
                    / {syncTotal}개 저장됨
                  </span>
                </div>

                {/* 누락 게임 목록 */}
                {syncMissing.length > 0 ? (
                  <div className="border border-[rgba(255,80,80,0.25)] bg-[rgba(255,80,80,0.05)] p-4">
                    <p className="mb-3 font-mono text-[0.65rem] uppercase tracking-wider text-red-400">
                      누락된 게임 {syncMissing.length}개
                    </p>
                    <ul className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                      {syncMissing.map((g) => (
                        <li key={g.appid} className="flex items-center gap-2 font-mono text-xs text-text-dim">
                          <span className="text-text-dim/40 w-16 flex-shrink-0">
                            {g.appid}
                          </span>
                          <span className="truncate">{g.name}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => setStep(2)}
                      className="mt-4 w-full border border-[rgba(45,212,191,0.3)] py-2.5 text-xs font-mono text-text-dim hover:border-accent hover:text-accent transition-colors"
                    >
                      누락 확인 완료 — 계속하기
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-text-dim">
                    전체 저장 완료 — 프로필 설정으로 이동합니다.
                  </p>
                )}
              </div>
            )}

            {/* 동기화 오류 */}
            {syncStatus === "error" && (
              <div className="flex flex-col items-center gap-4 py-6">
                <p className="font-mono text-sm text-red-400">
                  동기화 중 오류가 발생했습니다.
                </p>
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={handleAgree}
                    className="border border-accent px-6 py-2 text-sm font-mono text-accent transition-colors hover:bg-accent hover:text-bg"
                  >
                    다시 시도
                  </button>
                  <button
                    onClick={() => setStep(2)}
                    className="mt-1 text-xs text-text-dim underline underline-offset-2 hover:text-text-main"
                  >
                    건너뛰고 계속하기
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Step 2: 프로필 설정
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-[500px]">
        <StepIndicator current={2} />

        <div className="border border-[rgba(45,212,191,0.2)] bg-[#161a23] p-8 sm:p-10">
          <p className="mb-6 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-accent">
            // STEP_02 — PROFILE_SETUP
          </p>
          <h2 className="mb-8 text-lg font-bold text-text-main">프로필 설정</h2>

          {/* ── 프로필 이미지 ────────────────────────────────────────────── */}
          <div className="mb-8">
            <Label>프로필 이미지</Label>
            <div className="flex items-center gap-5">
              {/* 미리보기 */}
              <div className="relative h-[72px] w-[72px] flex-shrink-0 overflow-hidden rounded-full border border-[rgba(45,212,191,0.35)] bg-[#0f1117]">
                {avatarPreview ? (
                  // blob URL이나 외부 URL 모두 처리하기 위해 <img> 사용
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarPreview}
                    alt="프로필 미리보기"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-mono text-xl text-text-dim/40">
                    ?
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="border border-[rgba(45,212,191,0.3)] px-4 py-2 text-xs font-mono text-text-dim transition-colors hover:border-accent hover:text-accent"
                >
                  파일 선택
                </button>
                <p className="text-[0.62rem] leading-relaxed text-text-dim/50">
                  jpg · jpeg · png · webp
                  <br />
                  최대 5MB
                </p>
              </div>
            </div>

            {avatarError && (
              <p className="mt-2 text-xs text-red-400">{avatarError}</p>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* ── 닉네임 ──────────────────────────────────────────────────── */}
          <div className="mb-6">
            <Label>닉네임</Label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="사용할 닉네임을 입력하세요"
              maxLength={30}
              className="w-full border border-[rgba(45,212,191,0.2)] bg-bg px-4 py-3 text-sm text-text-main placeholder-[rgba(160,168,184,0.4)] outline-none transition-colors focus:border-accent"
            />
            {steamNickname && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[0.7rem] text-text-dim/60">
                  현재 Steam 닉네임: {steamNickname}
                </span>
                <button
                  type="button"
                  onClick={() => setNickname(steamNickname)}
                  className="text-[0.7rem] text-accent underline underline-offset-2 hover:no-underline"
                >
                  Steam 닉네임 불러오기
                </button>
              </div>
            )}
          </div>

          {/* ── 성별 ────────────────────────────────────────────────────── */}
          <div className="mb-10">
            <Label>성별</Label>
            <div className="flex gap-6">
              {(["male", "female", "private"] as Gender[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  className="flex items-center gap-2 focus:outline-none"
                >
                  {/* 커스텀 라디오 */}
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full border transition-colors ${
                      gender === g
                        ? "border-accent"
                        : "border-[rgba(45,212,191,0.3)]"
                    }`}
                  >
                    {gender === g && (
                      <span className="h-2 w-2 rounded-full bg-accent" />
                    )}
                  </span>
                  <span
                    className={`text-sm transition-colors ${
                      gender === g ? "text-text-main" : "text-text-dim"
                    }`}
                  >
                    {GENDER_LABELS[g]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ── 오류 메시지 ─────────────────────────────────────────────── */}
          {submitError && (
            <p className="mb-4 text-xs text-red-400">{submitError}</p>
          )}

          {/* ── 시작하기 버튼 ───────────────────────────────────────────── */}
          <button
            onClick={handleSubmit}
            disabled={!nickname.trim() || isSubmitting}
            className="w-full bg-accent py-4 text-sm font-bold tracking-wide text-bg transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {isSubmitting ? "저장 중..." : "시작하기"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 보조 컴포넌트 ─────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-text-dim">
      {children}
    </p>
  );
}

function StepIndicator({ current }: { current: 1 | 2 }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      {([1, 2] as const).map((n) => (
        <div key={n} className="flex items-center gap-3">
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full border text-[0.65rem] font-mono font-bold transition-colors ${
              current === n
                ? "border-accent bg-accent text-bg"
                : current > n
                ? "border-accent/40 bg-accent/10 text-accent/40"
                : "border-[rgba(45,212,191,0.2)] text-text-dim/40"
            }`}
          >
            {n}
          </div>
          <span
            className={`text-[0.7rem] font-mono transition-colors ${
              current === n ? "text-text-main" : "text-text-dim/40"
            }`}
          >
            {n === 1 ? "데이터 동의" : "프로필 설정"}
          </span>
          {n < 2 && (
            <span className="font-mono text-[0.65rem] text-text-dim/20">
              /
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
