export type ServiceItem = {
  num: string;
  title: string;
  description: string;
};

export const serviceItems: ServiceItem[] = [
  {
    num: "01",
    title: "같이 게임할 사람 , 여기서 끝",
    description:
      "내 스팀 라이브러리에서 게임을 골라 방을 열면, 실시간 채팅과 팀원 모집까지 한 번에 완료됩니다",
  },
  {
    num: "02",
    title: "팀 매칭 스케줄러",
    description:
      "파티 날짜 잡으려고 단톡방 따로 만들 필요 없습니다. 방 안에서 바로 일정을 올리고, 누가 참여하는지 실시간으로 확인합니다. 새 팀원이 와도 일정 히스토리가 그대로 쌓여 있습니다.",
  },
  {
    num: "03",
    title: "AI 추천 에이전트",
    description:
      '내 플레이타임, 장르, 플레이 패턴을 읽고 게임과 방을 대화로 찾아줍니다. 알고리즘 리스트가 아니라, 내 취향을 아는 팀원한테 물어보는 것처럼요.',
  },
];
