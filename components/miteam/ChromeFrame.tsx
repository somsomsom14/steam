const cornerBaseClass =
  "absolute z-50 h-5 w-5 border border-accent pointer-events-none";

export function ChromeFrame() {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(to_right,var(--border-low)_1px,transparent_1px),linear-gradient(to_bottom,var(--border-low)_1px,transparent_1px)] bg-[size:80px_80px]" />
      <div className="pointer-events-none fixed left-1/2 top-[-20%] z-[1] h-[80vh] w-screen -translate-x-1/2 bg-[radial-gradient(circle,rgba(45,212,191,0.12)_0%,transparent_70%)]" />

      <div className={`${cornerBaseClass} left-10 top-10 border-b-0 border-r-0`} />
      <div className={`${cornerBaseClass} right-10 top-10 border-b-0 border-l-0`} />
      <div className={`${cornerBaseClass} bottom-10 left-10 border-r-0 border-t-0`} />
      <div className={`${cornerBaseClass} bottom-10 right-10 border-l-0 border-t-0`} />

      <div className="pointer-events-none absolute left-1/2 top-5 z-50 -translate-x-1/2 font-mono text-[0.6rem] text-text-dim/60">
        LAT: 37.5665 / LON: 126.9780 [SEOUL_CORE]
      </div>
      <div className="pointer-events-none absolute bottom-5 left-1/2 z-50 -translate-x-1/2 font-mono text-[0.6rem] text-text-dim/60">
        SYSTEM STATUS: NOMINAL // VERSION 2.0.4
      </div>
    </>
  );
}
