import { serviceItems } from "./data";
import { ServiceCard } from "./ServiceCard";
import "./services.css";

export function ServicesSection() {
  return (
    <section className="services-section">
      <header className="section-header">
        <div className="sys-log">System Operation &gt; Target: Solution_Deployment</div>
        <h2 className="section-title">
          MI-TEAM이 팀을 만드는 방법<span className="cursor" />
        </h2>
      </header>

      <div className="card-grid">
        {serviceItems.map((item) => (
          <ServiceCard key={item.num} item={item} />
        ))}
      </div>
    </section>
  );
}
