export function TechOrnament() {
  return (
    <svg className="tech-ornament" viewBox="0 0 100 100" aria-hidden>
      <circle
        cx="50"
        cy="50"
        r="48"
        fill="none"
        stroke="var(--feedback-border-subtle)"
        strokeWidth="1"
      />
      <circle
        cx="50"
        cy="50"
        r="35"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="0.5"
        strokeDasharray="4 8"
      />
      <circle
        cx="50"
        cy="50"
        r="20"
        fill="none"
        stroke="var(--feedback-border-subtle)"
        strokeWidth="1"
      />
      <path
        d="M50 0v100M0 50h100"
        stroke="var(--accent)"
        strokeWidth="0.5"
        opacity="0.3"
      />
      <circle cx="50" cy="50" r="2" fill="var(--accent)" />
    </svg>
  );
}
