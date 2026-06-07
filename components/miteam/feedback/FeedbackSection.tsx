import { FeedbackCard } from "./FeedbackCard";
import { feedbackItems } from "./data";
import { TechOrnament } from "./TechOrnament";
import "./feedback.css";

export function FeedbackSection() {
  return (
    <section className="feedback-section" aria-labelledby="feedback-title">
      <div className="feedback-container">
        <section className="display-section">
          <div className="title-group">
            <div className="title-eyebrow" aria-hidden>
              <span className="title-eyebrow__dot" />
              <span className="title-eyebrow__line" />
            </div>
            <h2 id="feedback-title">
              PLAYER_
              <span>
                REVIEWS
                <span className="title-cursor" aria-hidden />
              </span>
            </h2>
            <div className="sys-log-divider" />
          </div>

          <TechOrnament />
        </section>

        <section className="cards-section" aria-label="사용자 후기">
          {feedbackItems.map((item) => (
            <FeedbackCard key={item.logId} item={item} />
          ))}
        </section>
      </div>
    </section>
  );
}
