import { gameCards } from "./data";
import { ChromeFrame } from "./ChromeFrame";
import { GameCarousel } from "./GameCarousel";
import { HeroContent } from "./HeroContent";
import { TopHeader } from "./TopHeader";

export function MiTeamLanding() {
  return (
    <div className="relative flex min-h-screen flex-col bg-bg text-text-main">
      <ChromeFrame />
      <TopHeader />

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center">
        <GameCarousel cards={gameCards} />
        <HeroContent />
      </main>
    </div>
  );
}
