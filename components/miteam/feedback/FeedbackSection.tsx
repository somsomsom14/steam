import { FeedbackCard } from "./FeedbackCard";
import { feedbackItems, feedbackMeta, systemLogLines } from "./data";
import { TechOrnament } from "./TechOrnament";
import "./feedback.css";

export function FeedbackSection() {
  return (
    <section className="feedback-section" aria-labelledby="feedback-title">
      <div className="feedback-container">
        <section className="display-section">
          <div className="top-meta">
            {feedbackMeta.map((label, index) => (
              <span key={label} className={index === feedbackMeta.length - 1 ? "active" : undefined}>
                {label}
              </span>
            ))}
          </div>

          <div className="title-group">
            <h2 id="feedback-title">
              USER_<span>FEEDBACK</span>
            </h2>
            <div className="sys-log-divider" />
            <div className="system-log-stream">
              {systemLogLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
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
