"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const WebGLBackground = dynamic(
  () => import("./WebGLBackground").then((m) => ({ default: m.WebGLBackground })),
  { ssr: false }
);

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

  const [step, setStep] = useState<1 | 2>(1);

  // Step 1
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncPercent, setSyncPercent] = useState(0);
  const [syncPhase, setSyncPhase] = useState("");
  const [syncCount, setSyncCount] = useState(0);
  const [syncTotal, setSyncTotal] = useState(0);
  const [syncMissing, setSyncMissing] = useState<{ appid: number; name: string }[]>([]);

  // Step 2
  const [nickname, setNickname] = useState("");
  const [gender, setGender] = useState<Gender>("private");
  const [avatarPreview, setAvatarPreview] = useState<string>(steamAvatarUrl);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarError, setAvatarError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAgree = async () => {
    setSyncStatus("syncing");
    setSyncPercent(0);
    setSyncPhase("준비 중");
    await fetch("/api/user/agree", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agreed: true }),
    }).catch(() => {});
    try {
      const res = await fetch("/api/steam/sync/stream", { method: "POST" });
      if (!res.ok || !res.body) {
        setSyncStatus("error");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let completed = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = JSON.parse(line.slice(6)) as {
            type: string;
            percent?: number;
            phase?: string;
            saved?: number;
            total?: number;
            missing?: { appid: number; name: string }[];
          };

          if (payload.type === "progress") {
            setSyncPercent(payload.percent ?? 0);
            setSyncPhase(payload.phase ?? "");
          } else if (payload.type === "complete") {
            completed = true;
            setSyncPercent(100);
            setSyncPhase("동기화 완료");
            setSyncCount(payload.saved ?? 0);
            setSyncTotal(payload.total ?? 0);
            setSyncMissing(payload.missing ?? []);
            setSyncStatus("done");
            if (!payload.missing?.length) {
              setTimeout(() => setStep(2), 2500);
            }
          } else if (payload.type === "error") {
            setSyncStatus("error");
            return;
          }
        }
      }

      if (!completed) setSyncStatus("error");
    } catch {
      setSyncStatus("error");
    }
  };

  const handleSkip = async () => {
    await fetch("/api/user/agree", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agreed: false }),
    }).catch(() => {});
    setStep(2);
  };

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
    e.target.value = "";
  };

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
      body: JSON.stringify({ app_nickname: nickname.trim(), app_avatar_url: avatarUrl, gender }),
    });
    if (res.ok) {
      router.push("/dashboard");
    } else {
      const data = await res.json().catch(() => ({}));
      setSubmitError(data.error ?? "저장에 실패했습니다. 다시 시도해주세요.");
      setIsSubmitting(false);
    }
  };

  // accent 색상 상수
  const A = "#2dd4bf";
  const A20 = "rgba(45,212,191,0.2)";
  const A30 = "rgba(45,212,191,0.3)";
  const A10 = "rgba(45,212,191,0.1)";

  return (
    <div className="flex w-screen h-screen overflow-hidden" style={{ background: "#050505", color: "#e2e8f0", fontFamily: "Inter, -apple-system, sans-serif" }}>

      {/* ── 좌측 폼 패널 (40%) ───────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center justify-center px-12 xl:px-24"
        style={{ width: "40%", minWidth: 340, background: "#050505" }}>

        {/* 우측 구분선 */}
        <div style={{
          position: "absolute", right: 0, top: 0, bottom: 0, width: 1,
          background: `linear-gradient(to bottom, transparent, ${A20} 20%, ${A20} 80%, transparent)`,
          zIndex: 20,
        }} />

        <div className="w-full" style={{ maxWidth: 360 }}>

          {/* 스텝 인디케이터 */}
          <StepIndicator current={step} />

          {/* ── STEP 1 ──────────────────────────────────────────────────────── */}
          {step === 1 && (
            <>
              <div className="mb-7">
                <h1 style={{ fontSize: "1.6rem", fontWeight: 700, marginBottom: 6, letterSpacing: "-0.02em", color: "#e2e8f0" }}>
                  계정 연동 완료
                </h1>
                <p style={{ color: "#a0a8b8", fontSize: "0.85rem", lineHeight: 1.6 }}>
                  게임 데이터를 분석해 맞춤 추천을 제공합니다.
                </p>
              </div>

              {syncStatus === "idle" && (
                <div className="flex flex-col gap-4">
                  <p style={{ fontSize: "0.85rem", color: "#a0a8b8", lineHeight: 1.8 }}>
                    보유 게임과 플레이 기록을 분석하여 나와 게임 취향이 비슷한
                    플레이어와 게임을 추천해드립니다.
                    <br /><br />
                    분석된 데이터는 본 사이트의 기능에만 사용되며, 다른 용도로
                    사용되거나 외부에 공개되지 않습니다.
                  </p>
                  <button
                    onClick={handleAgree}
                    className="w-full flex items-center justify-center gap-2"
                    style={{
                      background: A, color: "#050505", fontWeight: 700,
                      borderRadius: 8, padding: "12px 0", fontSize: "0.9rem",
                      border: "none", cursor: "pointer", marginTop: 8,
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.boxShadow = `0 0 20px rgba(45,212,191,0.35)`)}
                    onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
                  >
                    분석하고 시작하기
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                    </svg>
                  </button>
                  <button
                    onClick={handleSkip}
                    style={{
                      width: "100%", background: "transparent",
                      border: `1px solid ${A20}`,
                      color: "#a0a8b8", borderRadius: 8,
                      padding: "12px 0", fontSize: "0.85rem", cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = A30; e.currentTarget.style.color = "#e2e8f0"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = A20; e.currentTarget.style.color = "#a0a8b8"; }}
                  >
                    나중에 하기
                  </button>
                </div>
              )}

              {syncStatus === "syncing" && (
                <div className="flex flex-col gap-5 py-4">
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%",
                      border: `2px solid ${A10}`,
                      borderTopColor: A,
                      animation: "spin 0.8s linear infinite",
                      flexShrink: 0,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                        <p style={{ fontSize: "0.9rem", color: "#e2e8f0", fontWeight: 500, margin: 0 }}>
                          {syncPhase || "Steam 게임 데이터 동기화 중..."}
                        </p>
                        <span style={{
                          fontFamily: "monospace", fontSize: "0.85rem", fontWeight: 700,
                          color: A, flexShrink: 0,
                        }}>
                          {syncPercent}%
                        </span>
                      </div>
                      <p style={{ fontSize: "0.75rem", color: "#a0a8b8", marginTop: 3 }}>
                        보유 게임 수에 따라 최대 1분 소요됩니다.
                      </p>
                    </div>
                  </div>
                  <div style={{
                    height: 4, borderRadius: 2, background: A10, overflow: "hidden",
                  }}>
                    <div style={{
                      height: "100%", borderRadius: 2, background: A,
                      width: `${syncPercent}%`,
                      transition: "width 0.35s ease",
                    }} />
                  </div>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              )}

              {syncStatus === "done" && (
                <div className="flex flex-col gap-4">
                  <p style={{ fontFamily: "monospace", fontSize: "0.65rem", letterSpacing: "0.2em", color: A, textTransform: "uppercase" }}>
                    // SYNC_COMPLETE
                  </p>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: "2.2rem", fontWeight: 800, color: "#e2e8f0" }}>{syncCount}</span>
                    <span style={{ fontSize: "0.85rem", color: "#a0a8b8" }}>/ {syncTotal}개 저장됨</span>
                  </div>
                  {syncMissing.length > 0 ? (
                    <div style={{ border: "1px solid rgba(255,80,80,0.2)", background: "rgba(255,80,80,0.04)", borderRadius: 8, padding: "14px 16px" }}>
                      <p style={{ fontFamily: "monospace", fontSize: "0.65rem", letterSpacing: "0.15em", color: "rgba(255,100,100,0.8)", textTransform: "uppercase", marginBottom: 10 }}>
                        누락된 게임 {syncMissing.length}개
                      </p>
                      <ul style={{ maxHeight: 120, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                        {syncMissing.map((g) => (
                          <li key={g.appid} style={{ display: "flex", gap: 10, fontFamily: "monospace", fontSize: "0.75rem", color: "#a0a8b8" }}>
                            <span style={{ color: "rgba(160,168,184,0.4)", width: 56, flexShrink: 0 }}>{g.appid}</span>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</span>
                          </li>
                        ))}
                      </ul>
                      <button onClick={() => setStep(2)} style={{
                        marginTop: 12, width: "100%", background: "transparent",
                        border: `1px solid ${A20}`, color: "#a0a8b8",
                        borderRadius: 6, padding: "9px 0", fontSize: "0.78rem", cursor: "pointer",
                        fontFamily: "monospace", letterSpacing: "0.05em",
                      }}>
                        누락 확인 완료 — 계속하기
                      </button>
                    </div>
                  ) : (
                    <p style={{ fontSize: "0.85rem", color: "#a0a8b8" }}>
                      전체 저장 완료 — 프로필 설정으로 이동합니다.
                    </p>
                  )}
                </div>
              )}

              {syncStatus === "error" && (
                <div className="flex flex-col gap-4 py-4">
                  <p style={{ fontSize: "0.85rem", color: "rgba(255,100,100,0.85)" }}>
                    동기화 중 오류가 발생했습니다.
                  </p>
                  <button onClick={handleAgree} style={{
                    width: "100%", background: "transparent",
                    border: `1px solid ${A30}`, color: A,
                    borderRadius: 8, padding: "11px 0", fontSize: "0.85rem", cursor: "pointer",
                  }}>
                    다시 시도
                  </button>
                  <button onClick={() => setStep(2)} style={{
                    background: "none", border: "none", color: "#a0a8b8",
                    fontSize: "0.8rem", cursor: "pointer", textDecoration: "underline",
                  }}>
                    건너뛰고 계속하기
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── STEP 2 ──────────────────────────────────────────────────────── */}
          {step === 2 && (
            <>
              <div className="mb-7">
                <h1 style={{ fontSize: "1.6rem", fontWeight: 700, marginBottom: 6, letterSpacing: "-0.02em", color: "#e2e8f0" }}>
                  프로필 설정
                </h1>
                <p style={{ color: "#a0a8b8", fontSize: "0.85rem" }}>
                  사용할 닉네임과 프로필을 설정해주세요.
                </p>
              </div>

              <div className="flex flex-col gap-5">
                {/* 프로필 이미지 */}
                <div>
                  <FieldLabel>프로필 이미지</FieldLabel>
                  {/* 정사각형 이미지 + 우측 버튼 */}
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    {/* 정사각형 썸네일 */}
                    <div style={{
                      width: 72, height: 72, flexShrink: 0,
                      border: `1px solid ${A20}`, background: "#0b0e14",
                      overflow: "hidden",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(160,168,184,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                        </svg>
                      )}
                    </div>

                    {/* 우측 버튼 + 설명 */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          background: "transparent",
                          border: `1px solid ${A20}`,
                          color: "#e2e8f0", padding: "7px 16px",
                          fontSize: "0.8rem", cursor: "pointer",
                          transition: "all 0.2s", fontFamily: "inherit",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = A; e.currentTarget.style.color = A; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = A20; e.currentTarget.style.color = "#e2e8f0"; }}
                      >
                        이미지 변경
                      </button>
                      <p style={{ fontSize: "0.68rem", color: "rgba(160,168,184,0.4)", margin: 0 }}>
                        jpg · png · webp · 최대 5MB
                      </p>
                    </div>
                  </div>
                  {avatarError && <p style={{ marginTop: 6, fontSize: "0.75rem", color: "rgba(255,100,100,0.85)" }}>{avatarError}</p>}
                  <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp" onChange={handleFileChange} style={{ display: "none" }} />
                </div>

                {/* 닉네임 */}
                <div>
                  <FieldLabel>닉네임</FieldLabel>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="사용할 닉네임을 입력하세요"
                    maxLength={30}
                    style={{
                      width: "100%", background: "#0b0e14",
                      border: `1px solid ${A20}`, borderRadius: 0,
                      padding: "11px 14px", fontSize: "0.875rem", color: "#e2e8f0",
                      outline: "none", boxSizing: "border-box",
                      transition: "border-color 0.2s",
                      fontFamily: "inherit",
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = A)}
                    onBlur={e => (e.currentTarget.style.borderColor = A20)}
                  />
                  {steamNickname && (
                    <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.72rem", color: "rgba(160,168,184,0.5)" }}>Steam: {steamNickname}</span>
                      <button type="button" onClick={() => setNickname(steamNickname)}
                        style={{ background: "none", border: "none", color: "rgba(224,232,240,0.7)", fontSize: "0.72rem", cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}>
                        불러오기
                      </button>
                    </div>
                  )}
                </div>

                {/* 성별 */}
                <div>
                  <FieldLabel>성별</FieldLabel>
                  <div style={{ display: "flex", gap: 20 }}>
                    {(["male", "female", "private"] as Gender[]).map((g) => (
                      <button key={g} type="button" onClick={() => setGender(g)}
                        style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                        <span style={{
                          width: 16, height: 16, borderRadius: "50%",
                          border: `1px solid ${gender === g ? "rgba(224,232,240,0.8)" : A20}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "border-color 0.15s",
                        }}>
                          {gender === g && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#e2e8f0" }} />}
                        </span>
                        <span style={{ fontSize: "0.85rem", color: gender === g ? "#e2e8f0" : "#a0a8b8", fontFamily: "inherit" }}>
                          {GENDER_LABELS[g]}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {submitError && <p style={{ fontSize: "0.78rem", color: "rgba(255,100,100,0.85)" }}>{submitError}</p>}

                <button
                  onClick={handleSubmit}
                  disabled={!nickname.trim() || isSubmitting}
                  className="w-full flex items-center justify-center gap-2"
                  style={{
                    background: A, color: "#050505", fontWeight: 700,
                    borderRadius: 8, padding: "12px 0", fontSize: "0.9rem",
                    border: "none", cursor: nickname.trim() && !isSubmitting ? "pointer" : "not-allowed",
                    opacity: nickname.trim() && !isSubmitting ? 1 : 0.35,
                    transition: "all 0.2s", marginTop: 4,
                  }}
                >
                  {isSubmitting ? "저장 중..." : "시작하기"}
                  {!isSubmitting && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                    </svg>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── 우측 WebGL 패널 (60%) ────────────────────────────────────────────── */}
      <div className="relative" style={{ width: "60%", height: "100%" }}>
        <WebGLBackground />
        {/* 좌측 페이드 그라디언트 */}
        <div style={{
          position: "absolute", inset: "0 auto 0 0", width: 128,
          background: "linear-gradient(to right, #050505, transparent)",
          pointerEvents: "none", zIndex: 10,
        }} />
      </div>
    </div>
  );
}

// ── 보조 컴포넌트 ─────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      marginBottom: 8, fontSize: "0.7rem", fontWeight: 500,
      color: "rgba(160,168,184,0.6)", textTransform: "uppercase", letterSpacing: "0.12em",
      fontFamily: "inherit",
    }}>
      {children}
    </p>
  );
}

function StepIndicator({ current }: { current: 1 | 2 }) {
  const A = "#2dd4bf";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
      {([1, 2] as const).map((n) => (
        <div key={n} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 24, height: 24, borderRadius: "50%",
            border: `1px solid ${current === n ? A : current > n ? "rgba(45,212,191,0.3)" : "rgba(45,212,191,0.15)"}`,
            background: current === n ? A : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "0.65rem", fontWeight: 700, fontFamily: "monospace",
            color: current === n ? "#050505" : current > n ? "rgba(45,212,191,0.4)" : "rgba(45,212,191,0.25)",
            transition: "all 0.3s",
          }}>
            {n}
          </div>
          <span style={{
            fontSize: "0.72rem", fontFamily: "monospace",
            color: current === n ? "#e2e8f0" : "rgba(160,168,184,0.35)",
            transition: "color 0.3s",
          }}>
            {n === 1 ? "데이터 동의" : "프로필 설정"}
          </span>
          {n < 2 && <span style={{ color: "rgba(45,212,191,0.2)", fontSize: "0.7rem" }}>/</span>}
        </div>
      ))}
    </div>
  );
}
