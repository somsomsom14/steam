"use client";

import { useEffect, useState } from "react";

const FALLBACK = "/images/miteam/game-01.jpg";

type Props = {
  src?: string | null;
  alt?: string;
  className?: string;
  fallback?: string;
};

/** 프로필 이미지 — 로드 실패 시 fallback, URL 변경 시 재시도 */
export function ProfileAvatar({
  src,
  alt = "",
  className,
  fallback = FALLBACK,
}: Props) {
  const [failed, setFailed] = useState(false);

  const trimmed = src?.trim() ?? "";
  const displaySrc = trimmed && !failed ? trimmed : fallback;

  useEffect(() => {
    setFailed(false);
  }, [trimmed]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={displaySrc}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
