export type ServiceItem = {
  num: string;
  label: string;
  title: string;
  description: string;
  dataLabel: string;
  barWidth: string;
  barTrackHighlight?: boolean;
  valueLeft: string;
  valueRight: string;
  statText: string;
};

export const serviceItems: ServiceItem[] = [
  {
    num: "01",
    label: "MODULE: ROOM_GEN",
    title: "게임 기반 팀 방",
    description:
      "내 스팀 라이브러리에서 게임을 고르고 방을 열면 끝입니다. 실시간 채팅, 방장 공지, 멤버 목록이 방 하나에 다 들어 있습니다. 5분이면 그 게임의 첫 한국인 팀 방이 생깁니다.",
    dataLabel: "Onboarding Time",
    barWidth: "23%",
    valueLeft: "",
    valueRight: "7 DAYS",
    statText: "방 개설 후 평균 7일 내 첫 팀원 합류",
  },
  {
    num: "02",
    label: "MODULE: SCHEDULE_SYNC",
    title: "팀 매칭 스케줄러",
    description:
      "파티 날짜 잡으려고 단톡방 따로 만들 필요 없습니다. 방 안에서 바로 일정을 올리고, 누가 참여하는지 실시간으로 확인합니다. 새 팀원이 와도 일정 히스토리가 그대로 쌓여 있습니다.",
    dataLabel: "Success Multiplier",
    barWidth: "100%",
    barTrackHighlight: true,
    valueLeft: "PREV: 1x",
    valueRight: "NEW: 3.0x",
    statText: "기존 방식 대비 팀 매칭 성사율 3배",
  },
  {
    num: "03",
    label: "MODULE: AI_AGENT",
    title: "AI 게임 추천 에이전트",
    description:
      '내 플레이타임, 장르, 플레이 패턴을 읽고 "다음엔 뭐 하면 좋을까?"를 대화로 찾아줍니다. 알고리즘 리스트가 아니라, 내 취향을 아는 팀원한테 물어보는 것처럼요.',
    dataLabel: "Play Conversion",
    barWidth: "87%",
    valueLeft: "SUGGESTED",
    valueRight: "87%",
    statText: "추천 게임 실제 플레이 전환율 87%",
  },
];
