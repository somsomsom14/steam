/** Figma Fintech dashboard design tokens (node 531:127) */
export const FIGMA = {
  pageBg: "#fcfcfc",
  mainBg: "#12272a",
  orange: "#ffa14e",
  green: "#36f097",
  greenCyan: "#3dffdc",
  pink: "#ef7be3",
  textPrimary: "#fffbfb",
  textMuted: "rgba(255,255,255,0.6)",
  textSidebar: "#828282",
  textSidebarLight: "#bdbdbd",
  borderLight: "#e0e0e0",
  donut: ["#5a3fff", "#268aff", "#1ed6ff", "#36f097", "#818cf8"],
} as const;

export const TRAIT_TAG_MAP: Record<string, string[]> = {
  협동: ["Co-op", "Online Co-op", "Local Co-op"],
  공포: ["Horror", "Psychological Horror", "Survival Horror"],
  경쟁: ["PvP", "Competitive", "Team-Based", "FPS"],
  생존: ["Survival", "Open World Survival Craft", "Crafting"],
  전술: ["Strategy", "Management", "Base Building"],
  소셜: ["Party", "Funny", "Social Deduction", "Party Game"],
};

export const TRAIT_LABEL_EN: Record<string, string> = {
  협동: "Co-op",
  공포: "Horror",
  경쟁: "Competitive",
  생존: "Survival",
  전술: "Strategy",
  소셜: "Social",
};

/** Steam Store categories — 영문 + 기존 한글 동기화 데이터 호환 */
export const MULTI_CATEGORIES = [
  "Multi-player",
  "멀티플레이어",
  "Online Co-op",
  "온라인 협동",
  "Local Co-op",
  "로컬 협동",
  "Shared/Split Screen Co-op",
  "화면 분할 협동",
  "Co-op",
  "협동",
  "MMO",
];

export const SINGLE_PLAYER_CATEGORIES = [
  "Single-player",
  "싱글 플레이어",
];

/** @deprecated SINGLE_PLAYER_CATEGORIES 사용 */
export const SINGLE_CATEGORY = "Single-player";

/** Steam Store genres — 실제 장르가 아닌 라벨 (Genre Distribution 제외) */
export const EXCLUDED_GENRES = [
  "Free to Play",
  "무료 플레이",
  "Early Access",
  "얼리 액세스",
  "Sexual Content",
  "성적 콘텐츠",
  "Nudity",
  "노출",
  "Massively Multiplayer",
  "대규모 멀티플레이어",
] as const;

const EXCLUDED_GENRES_LOWER = new Set(
  EXCLUDED_GENRES.map((g) => g.toLowerCase())
);

export function isExcludedGenre(genre: string): boolean {
  return EXCLUDED_GENRES_LOWER.has(genre.toLowerCase());
}
