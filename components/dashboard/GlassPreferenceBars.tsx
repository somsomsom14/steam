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

/** Figma 635:992 — isometric square column with ghost shell + rising fill */
function Column3D({
  label,
  percent,
  delay,
  mounted,
  animationMs,
}: {
  label: string;
  percent: number;
  delay: number;
  mounted: boolean;
  animationMs: number;
}) {
  const fillH = mounted ? percent : 0;

  return (
    <div className="col3d">
      <span className="col3d__pct">{Math.round(percent)}%</span>
      <div className="col3d__stage">
        {/* Full-height ghost container */}
        <div className="col3d__shell col3d__shell--ghost" aria-hidden>
          <div className="col3d__front" />
          <div className="col3d__right" />
          <div className="col3d__top" />
        </div>
        {/* Animated fill — shell is full height, clip reveals from bottom */}
        <div
          className="col3d__fill-clip"
          style={{
            height: `${fillH}%`,
            transitionDelay: `${delay}ms`,
            transitionDuration: `${animationMs}ms`,
          }}
        >
          <div className="col3d__shell col3d__shell--fill">
            <div className="col3d__front" />
            <div className="col3d__right" />
            <div className="col3d__top col3d__top--lit" />
          </div>
        </div>
      </div>
      <span className="col3d__label">{label}</span>
    </div>
  );
}

export function GlassPreferenceBars({ items, animationMs = 1400 }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <div className="col3d-chart">
      {items.map((item, i) => (
        <Column3D
          key={item.label}
          label={item.label}
          percent={item.percent}
          delay={i * 150}
          mounted={mounted}
          animationMs={animationMs}
        />
      ))}
    </div>
  );
}
