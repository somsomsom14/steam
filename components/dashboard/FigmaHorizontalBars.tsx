"use client";

import { useEffect, useState } from "react";

type BarItem = {
  name: string;
  fullName: string;
  hours: number;
  recent: number;
};

type Props = {
  items: BarItem[];
  maxHours: number;
};

/** Figma-style dual horizontal bars: 전체(초록) + 최근 2주(시안) */
export function FigmaHorizontalBars({ items, maxHours }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const ticks = [0, 40, 80, 120, 160, 200];
  const scaleMax = Math.max(maxHours, 200);

  return (
    <div className="figma-hbars">
      <div className="figma-hbars__legend">
        <span className="figma-hbars__legend-item">
          <span className="figma-hbars__legend-dot figma-hbars__legend-dot--total" />
          전체 플레이
        </span>
        <span className="figma-hbars__legend-item">
          <span className="figma-hbars__legend-dot figma-hbars__legend-dot--recent" />
          최근 2주
        </span>
      </div>
      <div className="figma-hbars__grid" aria-hidden>
        {ticks.map((tick) => (
          <div
            key={tick}
            className="figma-hbars__grid-col"
            style={{ left: `${(tick / scaleMax) * 100}%` }}
          >
            <span className="figma-hbars__grid-label">{tick}</span>
          </div>
        ))}
      </div>
      <div className="figma-hbars__rows">
        {items.map((item, i) => {
          const totalPct = Math.min(100, (item.hours / scaleMax) * 100);
          const recentPct = Math.min(100, (item.recent / scaleMax) * 100);
          return (
            <div key={item.fullName} className="figma-hbars__row">
              <span className="figma-hbars__name" title={item.fullName}>
                {item.fullName}
              </span>
              <div className="figma-hbars__bars">
                <div className="figma-hbars__bar-track">
                  <div
                    className="figma-hbars__bar figma-hbars__bar--total"
                    style={{
                      width: mounted ? `${totalPct}%` : "0%",
                      transitionDelay: `${i * 90}ms`,
                    }}
                  />
                </div>
                <div className="figma-hbars__bar-track">
                  <div
                    className="figma-hbars__bar figma-hbars__bar--recent"
                    style={{
                      width: mounted ? `${recentPct}%` : "0%",
                      transitionDelay: `${i * 90 + 60}ms`,
                    }}
                  />
                </div>
              </div>
              <span className="figma-hbars__value">
                {item.hours}h
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
