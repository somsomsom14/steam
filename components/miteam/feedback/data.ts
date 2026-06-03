export type FeedbackItem = {
  avatar: string;
  name: string;
  stats: [string, string];
  logId: string;
  quote: string;
  result: string;
};

export const feedbackMeta = [
  "SEC.04_TESTIMONIALS",
  "MI_TEAM_PLATFORM",
  "SYS.ONLINE",
] as const;

export const systemLogLines = [
  "Querying databanks... [OK]",
  "Filtering by highest impact rating...",
  "Rendering selected transmission logs.",
] as const;

export const feedbackItems: FeedbackItem[] = [
  {
    avatar: "KS",
    name: "김서준",
    stats: ["STEAM_3200H", "STRATEGY/SIM"],
    logId: "REC_01A",
    quote:
      "Dwarf Fortress 한국 팀이 없어서 포기하려던 차에 MI-TEAM에서 방을 열었어요. 2주 만에 정기 팀원이 11명 모였고, 이제 매주 금요일마다 같이 합니다. 외국인들이랑 말도 못하고 하던 게임이랑은 완전히 다른 경험입니다.",
    result: "RESULT: 11_TEAM_MEMBERS // WEEKLY_SESSIONS_ESTABLISHED",
  },
  {
    avatar: "PJ",
    name: "박지현",
    stats: ["STEAM_1800H", "INDIE/SURVIVAL"],
    logId: "REC_02B",
    quote:
      "인디 서바이벌 게임 좋아하는데 한국인 팀을 찾을 방법이 아예 없었어요. AI한테 제 플레이 스타일 얘기했더니 저를 저보다 잘 아는 것 같은 추천을 해줬고, 그 게임 팀 방도 바로 만들었습니다. 지금은 제가 방장이에요.",
    result: "RESULT: AI_RECOMMENDATION_SUCCESS // USER_PROMOTED_TO_HOST",
  },
];
