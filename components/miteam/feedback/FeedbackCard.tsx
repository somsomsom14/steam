import type { FeedbackItem } from "./data";

type FeedbackCardProps = {
  item: FeedbackItem;
};

export function FeedbackCard({ item }: FeedbackCardProps) {
  return (
    <article className="feedback-card">
      <div className="card-header">
        <div className="user-identity">
          <div className="avatar">{item.avatar}</div>
          <div className="user-details">
            <span className="user-name">{item.name}</span>
            <div className="user-stats">
              <span>{item.stats[0]}</span>
              <span>{item.stats[1]}</span>
            </div>
          </div>
        </div>
        <div className="log-id-pill">{item.logId}</div>
      </div>

      <div className="quote-block">
        <p>{item.quote}</p>
      </div>

      <div className="key-result">{item.result}</div>
    </article>
  );
}
