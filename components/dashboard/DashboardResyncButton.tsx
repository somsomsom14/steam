"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STEAM_PROFILE_PRIVATE_MSG =
  "Steam 프로필·게임 상세가 비공개입니다 Steam 프로필보기 → 프로필 편집 → 공개설정 → 프로필: 공개로 변경후 다시 동기화해 주세요.";

export function DashboardResyncButton({ label = "Steam 다시 동기화" }: { label?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSync = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/steam/sync", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError("동기화에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      if (data.profile_public === false) {
        setError(STEAM_PROFILE_PRIVATE_MSG);
        router.refresh();
        return;
      }
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-resync">
      <button
        type="button"
        className="dashboard-empty__btn"
        onClick={handleSync}
        disabled={loading}
      >
        {loading ? "동기화 중…" : label}
      </button>
      {error && <p className="dashboard-resync__error">{error}</p>}
    </div>
  );
}
