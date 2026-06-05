"use client";

import Link from "next/link";
import { useState } from "react";

const NAV: {
  label: string;
  href: string;
  icon: string;
  disabled?: boolean;
}[] = [
  { label: "대시보드", href: "/dashboard", icon: "grid" },
  { label: "방 찾기", href: "/rooms", icon: "search" },
  { label: "AI문의방", href: "/chat", icon: "chat" },
  { label: "내 게임", href: "#", icon: "game", disabled: true },
];

function NavIcon({ type }: { type: string }) {
  const props = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
  };
  if (type === "grid")
    return (
      <svg {...props}>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    );
  if (type === "search")
    return (
      <svg {...props}>
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3-3" />
      </svg>
    );
  if (type === "chat")
    return (
      <svg {...props}>
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    );
  return (
    <svg {...props}>
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
    </svg>
  );
}

export function DashboardSidebar({ activePath }: { activePath?: string } = {}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`dashboard-sidebar-wrap${open ? " is-open" : ""}`}>
      <aside className="dashboard-sidebar">
        <Link href="/" className="dashboard-sidebar__logo">
          MI-TEAM
        </Link>

        <nav className="dashboard-sidebar__nav">
          {NAV.map((item) =>
            item.disabled ? (
              <span key={item.label} className="dashboard-sidebar__link is-disabled">
                <NavIcon type={item.icon} />
                {item.label}
              </span>
            ) : (
              <Link
                key={item.label}
                href={item.href}
                className={`dashboard-sidebar__link${activePath === item.href ? " is-active" : ""}`}
              >
                <NavIcon type={item.icon} />
                {item.label}
              </Link>
            )
          )}
        </nav>

        <div className="dashboard-sidebar__divider" />

        <div className="dashboard-sidebar__footer">
          <Link href="/" className="dashboard-sidebar__link">
            첫 화면으로
          </Link>
        </div>
      </aside>

      <button
        type="button"
        className="dashboard-sidebar-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "사이드바 닫기" : "사이드바 열기"}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transition: "transform 0.3s ease", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>
  );
}
