"use client";

import { useEffect, useRef } from "react";
import { ROOM_CHAT_EMOJIS } from "@/lib/rooms/chat-emojis";

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (emoji: string) => void;
};

export function RoomChatEmojiPicker({ open, onClose, onPick }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div ref={panelRef} className="chat-emoji-picker" role="listbox" aria-label="이모지 선택">
      {ROOM_CHAT_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="chat-emoji-picker__btn"
          onClick={() => {
            onPick(emoji);
            onClose();
          }}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
