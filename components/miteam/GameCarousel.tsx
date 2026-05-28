"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import type { GameCard } from "./types";

const CARD_W = 280;
const CARD_H = 420;

type GameCarouselProps = {
  cards: GameCard[];
};

export function GameCarousel({ cards }: GameCarouselProps) {
  return (
    <div className="absolute left-1/2 top-1/2 z-[5] h-[600px] w-full -translate-x-1/2 -translate-y-[48%] [perspective:2000px] [perspective-origin:50%_50%] [&:has(article:hover)_.carousel-track]:[animation-play-state:paused]">
      {/* 회전축 = 이 점 하나 (0×0 허브) */}
      <div className="carousel-track absolute left-1/2 top-1/2 h-0 w-0 [transform-style:preserve-3d] [animation:rotate-carousel_60s_linear_infinite]">
        {cards.map((card, index) => {
          const cardStyle: CSSProperties = {
            left: -CARD_W / 2,
            top: -CARD_H / 2,
            width: CARD_W,
            height: CARD_H,
            transform: `rotateY(${index * 45}deg) translateZ(var(--carousel-depth))`,
            transformOrigin: "center center",
          };

          return (
            <article
              key={card.id}
              className="group pointer-events-auto absolute overflow-hidden border border-border-high bg-surface [backface-visibility:hidden] max-[1024px]:h-[330px] max-[1024px]:w-[220px]"
              style={cardStyle}
            >
              <div className="relative h-full w-full">
                <Image
                  src={card.image}
                  alt={card.title}
                  fill
                  sizes="(max-width: 1024px) 220px, 280px"
                  className="object-cover opacity-70 grayscale-[40%] contrast-110 transition-[filter,opacity] duration-500 group-hover:opacity-100 group-hover:grayscale-0 group-hover:contrast-100"
                />
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
