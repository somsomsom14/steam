export type UserGameRow = {
  appid: number;
  game_name: string | null;
  genres: string[];
  categories: string[];
  tags: string[];
  playtime_forever: number;
  playtime_2weeks: number;
};

export type RadarPoint = {
  trait: string;
  value: number;
  rawMinutes: number;
};

export type GenreSlice = {
  genre: string;
  minutes: number;
  percent: number;
};

export type PlayPreference = {
  label: string;
  minutes: number;
  percent: number;
};

export type TopGameBar = {
  appid: number;
  name: string;
  playtimeForeverHours: number;
  playtime2WeeksHours: number;
  playtimeForeverMinutes: number;
  playtime2WeeksMinutes: number;
};

export type DashboardStats = {
  /** playtime_forever > 0 인 게임 수 (차트 분석 대상) */
  gameCount: number;
  /** DB에 저장된 전체 게임 수 */
  libraryCount: number;
  /** 보유했지만 플레이 시간 0인 게임 수 */
  zeroPlaytimeCount: number;
  totalPlaytimeMinutes: number;
  totalPlaytimeHours: number;
};

export type DashboardAnalysis = {
  stats: DashboardStats;
  radar: RadarPoint[];
  genres: GenreSlice[];
  playPreference: PlayPreference[];
  topGames: TopGameBar[];
  recentGames: { name: string; playtime2WeeksHours: number }[];
  topTrait: string | null;
  multiPercent: number;
  singlePercent: number;
};
