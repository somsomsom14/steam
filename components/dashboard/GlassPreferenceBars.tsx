"use client";

import { useEffect, useState } from "react";

type BarItem = {
  label: string;
  percent: number;
};

type Props = {
  items: BarItem[];
  animationMs?: number;
};

const THEMES = [
  {
    base: "#3dffdc",
    light: "#9afbec",
    dark: "#18a88f",
    side: "#2bc4a8",
    glow: "rgba(61, 255, 220, 0.45)",
  },
  {
    base: "#36f097",
    light: "#7dffc0",
    dark: "#1a9c5c",
    side: "#28c078",
    glow: "rgba(54, 240, 151, 0.45)",
  },
] as const;

function HorizontalBar3D({
  label,
  percent,
  theme,
  delay,
  mounted,
  animationMs,
}: {
  label: string;
  percent: number;
  theme: (typeof THEMES)[number];
  delay: number;
  mounted: boolean;
  animationMs: number;
}) {
  const w = mounted ? Math.min(100, Math.max(0, percent)) : 0;
  const showCap = w >= 6;

  return (
    <div
      className="pref3d-row"
      style={
        {
          "--bar-base": theme.base,
          "--bar-light": theme.light,
          "--bar-dark": theme.dark,
          "--bar-side": theme.side,
          "--bar-glow": theme.glow,
        } as React.CSSProperties
      }
    >
      <div className="pref3d-row__head">
        <span className="pref3d-row__label">{label}</span>
        <span className="pref3d-row__pct">{Math.round(percent)}%</span>
      </div>

      <div className="pref3d-row__track">
        <div className="pref3d-row__ghost" aria-hidden />
        <div
          className="pref3d-row__fill"
          style={{
            width: `${w}%`,
            minWidth: w > 0 && w < 6 ? 4 : 0,
            transitionDelay: `${delay}ms`,
            transitionDuration: `${animationMs}ms`,
          }}
        >
          {showCap && <div className="pref3d-row__cap" />}
          <div className="pref3d-row__body">
            <div className="pref3d-row__face" />
            {showCap && <div className="pref3d-row__edge" />}
            {w >= 10 && <div className="pref3d-row__shine" />}
          </div>
        </div>
      </div>
    </div>
  );
}

export function GlassPreferenceBars({ items, animationMs = 1400 }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="pref3d-chart pref3d-chart--horizontal">
      {items.map((item, i) => (
        <HorizontalBar3D
          key={item.label}
          label={item.label}
          percent={item.percent}
          theme={THEMES[i % THEMES.length]}
          delay={i * 180}
          mounted={mounted}
          animationMs={animationMs}
        />
      ))}
    </div>
  );
}
