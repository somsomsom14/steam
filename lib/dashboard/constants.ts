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

export const MULTI_CATEGORIES = [
  "Multi-player",
  "Online Co-op",
  "Local Co-op",
  "Co-op",
  "MMO",
];

export const SINGLE_CATEGORY = "Single-player";
