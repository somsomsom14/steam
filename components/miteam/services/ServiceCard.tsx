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

      <div className="card-top">
        <span className="card-num">{item.num}</span>
        <div className="card-top-line" aria-hidden />
      </div>

      <div className="card-content">
        <h3 className="card-title">{item.title}</h3>
        <p className="card-desc">{item.description}</p>
        <div className="card-divider" aria-hidden />
      </div>
    </article>
  );
}
