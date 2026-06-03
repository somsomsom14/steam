export type ChatIntent = "게임추천" | "방추천" | "성향분석" | "일반문의";

export type ChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type UserGameRecord = {
  appid: number;
  game_name: string | null;
  genres: unknown;
  categories: unknown;
  tags: unknown;
  playtime_forever: number | string | null;
};

export type TagTendency = {
  tag: string;
  minutes: number;
  hours: number;
};

export type RoomForRecommend = {
  id: string;
  title: string;
  subtitle: string | null;
  game_name: string;
  tags: string[];
  member_count: number;
};
