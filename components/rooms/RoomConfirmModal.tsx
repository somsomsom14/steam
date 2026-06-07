"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function RoomConfirmModal({
  title,
  description,
  confirmLabel = "확인",
  cancelLabel = "취소",
  variant = "default",
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) onCancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [loading, onCancel]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="chat-modal-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onCancel();
      }}
    >
      <div
        className="chat-modal chat-modal--confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="room-confirm-title">{title}</h3>
        {description && <p className="chat-modal__confirm-desc">{description}</p>}
        <div className="chat-modal__actions">
          <button
            type="button"
            className="chat-modal__cancel"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={
              variant === "danger"
                ? "chat-modal__confirm-ok chat-modal__confirm-ok--danger"
                : "chat-modal__confirm-ok"
            }
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "처리 중..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
