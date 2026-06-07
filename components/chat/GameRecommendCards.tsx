import {
  steamHeaderImageUrl,
  steamStoreUrl,
} from "@/lib/ai/game-recommend-utils";
import type { GameRecommendItem } from "@/lib/ai/types";

type Props = {
  intro: string;
  games: GameRecommendItem[];
  onMoreRecs: () => void;
  disabled?: boolean;
};

export function GameRecommendCards({ intro, games, onMoreRecs, disabled }: Props) {
  return (
    <div className="ai-game-recs">
      {intro && <p className="ai-game-recs__intro">{intro}</p>}
      <div className="ai-game-recs__grid">
        {games.map((game) => {
          const thumb = steamHeaderImageUrl(game.appid);
          const store = steamStoreUrl(game.appid);

          return (
            <article key={`${game.appid}-${game.name}`} className="ai-game-recs__card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumb} alt="" className="ai-game-recs__thumb" loading="lazy" />
              <div className="ai-game-recs__body">
                <h3 className="ai-game-recs__name">{game.name}</h3>
                <p className="ai-game-recs__reason">{game.reason}</p>
                <a
                  href={store}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ai-game-recs__store-link"
                >
                  {store}
                </a>
              </div>
            </article>
          );
        })}
      </div>
      <button
        type="button"
        className="ai-game-recs__more"
        onClick={onMoreRecs}
        disabled={disabled}
      >
        더 추천받기
      </button>
    </div>
  );
}
