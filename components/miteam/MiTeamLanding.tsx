import { gameCards } from "./data";
import { ChromeFrame } from "./ChromeFrame";
import { GameCarousel } from "./GameCarousel";
import { HeroContent } from "./HeroContent";
import { FeedbackSection } from "./feedback/FeedbackSection";
import { ServicesSection } from "./services/ServicesSection";
import { TopHeader } from "./TopHeader";

export function MiTeamLanding() {
  return (
    <div className="relative bg-bg text-text-main">
      <section className="relative flex min-h-screen flex-col overflow-hidden">
        <ChromeFrame />
        <TopHeader />

        <main className="relative z-10 flex flex-1 flex-col items-center justify-center">
          <GameCarousel cards={gameCards} />
          <HeroContent />
        </main>
      </section>

      <ServicesSection />
      <FeedbackSection />
    </div>
  );
}
