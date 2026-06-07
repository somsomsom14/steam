export function HeroContent() {
  return (
    <section className="pointer-events-none relative z-20 mx-auto flex w-full max-w-[1100px] -translate-y-20 flex-col items-center gap-7 px-6 text-center">
      <h1 className="text-[clamp(2.8rem,7vw,5.4rem)] leading-[1.04] font-black tracking-[-0.045em] break-keep">
        나만 하는 줄 알았던 그 게임
      </h1>
      <p className="mx-auto w-full max-w-[520px] text-center text-[1.15rem] leading-[1.6] text-[#b8c2ce] break-keep max-[1024px]:text-[1.1rem]">
        MI-TEAM에선 어떤 스팀 게임이든 <br />
        같이 할 수 있는 팀이 생깁니다.
      </p>
      <div className="pointer-events-auto">
        <a
          href="/api/auth/steam/login"
          className="group relative inline-flex min-h-[78px] min-w-[210px] items-center justify-center overflow-hidden bg-accent px-[88px] py-[30px] text-center text-[1.1rem] font-bold tracking-[0.05em] text-bg transition-[transform,box-shadow] duration-200 [transition-timing-function:cubic-bezier(0.2,0,0,1)] hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(45,212,191,0.3)]"
        >
          우리 팀 찾기
          <span className="pointer-events-none absolute inset-y-0 left-[-100%] w-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)] transition-[left] duration-500 group-hover:left-full" />
        </a>
      </div>
    </section>
  );
}
