import type { ServiceItem } from "./data";

type ServiceCardProps = {
  item: ServiceItem;
};

export function ServiceCard({ item }: ServiceCardProps) {
  return (
    <article className="service-card">
      <div className="brackets">
        <div className="brackets-inner" />
      </div>

      <div className="card-meta">
        <span className="card-num">{item.num}</span>
        <span className="card-label">{item.label}</span>
      </div>

      <h3 className="card-title">{item.title}</h3>
      <p className="card-desc">{item.description}</p>

      <div className="card-footer">
        <div className="data-row">
          <span className="data-label">{item.dataLabel}</span>
          <div
            className={`data-bar-container ${item.barTrackHighlight ? "is-highlight" : ""}`}
          >
            <div className="data-bar-fill" style={{ width: item.barWidth }} />
          </div>
          <div className="data-value">
            {item.valueLeft ? <span>{item.valueLeft}</span> : <span />}
            <span>{item.valueRight}</span>
          </div>
        </div>
        <div className="stat-text">
          <span className="arrow">-&gt;</span>
          <em>{item.statText}</em>
        </div>
      </div>
    </article>
  );
}
