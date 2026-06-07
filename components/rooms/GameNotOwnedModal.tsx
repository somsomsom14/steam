"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { steamStoreUrl } from "@/lib/ai/game-recommend-utils";

type Props = {
  gameName: string;
  gameAppid: number;
  onConfirm: () => void;
};

export function GameNotOwnedModal({ gameName, gameAppid, onConfirm }: Props) {
  const storeUrl = steamStoreUrl(gameAppid);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return createPortal(
    <div className="room-game-gate" onClick={onConfirm} role="presentation">
      <div
        className="room-game-gate__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-game-gate-title"
        onClick={(e) => e.stopPropagation()}
      >
        <svg
          className="room-game-gate__icon"
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden
        >
          <rect x="3" y="5" width="18" height="12" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
        <div className="room-game-gate__notice">
          <h2 id="room-game-gate-title" className="room-game-gate__title">
            이 게임을 보유하고 있지 않습니다.
          </h2>
          <p className="room-game-gate__desc">
            이 방은 <strong>{gameName}</strong> 보유자만 입장할 수 있습니다.
          </p>
        </div>
        <p className="room-game-gate__hint">게임을 구매해 보세요</p>
        <a
          href={storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="room-game-gate__store-link"
        >
          {gameName}
        </a>
        <button
          type="button"
          className="room-game-gate__confirm"
          onClick={(e) => {
            e.stopPropagation();
            onConfirm();
          }}
        >
          확인
        </button>
      </div>
    </div>,
    document.body
  );
}
