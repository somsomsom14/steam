import { steamHeaderImageUrl } from "@/lib/ai/game-recommend-utils";
import type { RoomRecommendItem } from "@/lib/ai/types";

type Props = {
  intro: string;
  rooms: RoomRecommendItem[];
};

export function RoomRecommendCards({ intro, rooms }: Props) {
  return (
    <div className="ai-game-recs">
      {intro && <p className="ai-game-recs__intro">{intro}</p>}
      <div className="ai-game-recs__grid">
        {rooms.map((room) => {
          const thumb = room.game_appid
            ? steamHeaderImageUrl(room.game_appid)
            : null;

          return (
            <article key={room.id} className="ai-game-recs__card">
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb} alt="" className="ai-game-recs__thumb" loading="lazy" />
              ) : (
                <div className="ai-game-recs__thumb ai-game-recs__thumb--empty" aria-hidden />
              )}
              <div className="ai-game-recs__body">
                <h3 className="ai-game-recs__name">{room.title}</h3>
                <p className="ai-game-recs__meta">
                  {room.game_name}
                  {room.member_count > 0 && ` · ${room.member_count}명`}
                  {room.tags.length > 0 && ` · ${room.tags.slice(0, 3).join(", ")}`}
                </p>
                {room.subtitle && <p className="ai-game-recs__meta">{room.subtitle}</p>}
                <p className="ai-game-recs__reason">{room.reason}</p>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
