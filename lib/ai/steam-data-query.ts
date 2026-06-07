import type { AnalysisMode } from "./orchestrator";
import { buildAnalysisAgentInput } from "./analysis-input";
import { parseUserGame } from "@/lib/dashboard/analytics";
import type { UserGameRecord } from "./types";

const KOREAN_ORDINALS: { pattern: RegExp; rank: number }[] = [
  { pattern: /첫\s*번째|1\s*번째|1\s*위/, rank: 1 },
  { pattern: /두\s*번째|2\s*번째|2\s*위/, rank: 2 },
  { pattern: /세\s*번째|3\s*번째|3\s*위/, rank: 3 },
  { pattern: /네\s*번째|넷\s*번째|4\s*번째|4\s*위/, rank: 4 },
  { pattern: /다섯\s*번째|5\s*번째|5\s*위/, rank: 5 },
  { pattern: /여섯\s*번째|6\s*번째|6\s*위/, rank: 6 },
  { pattern: /일곱\s*번째|7\s*번째|7\s*위/, rank: 7 },
  { pattern: /여덟\s*번째|8\s*번째|8\s*위/, rank: 8 },
  { pattern: /아홉\s*번째|9\s*번째|9\s*위/, rank: 9 },
  { pattern: /열\s*번째|10\s*번째|10\s*위/, rank: 10 },
];

function normalizeMessage(message: string) {
  return message.replace(/\s+/g, " ").trim();
}

function formatHoursCasual(minutes: number): string {
  const h = Math.round(minutes / 60);
  return h >= 1 ? `${h.toLocaleString("ko-KR")}시간` : `${minutes}분`;
}

function formatKrw(value: number): string {
  return `${value.toLocaleString("ko-KR")}원`;
}

export function getPlaytimeRankedGames(games: UserGameRecord[]) {
  return games
    .map(parseUserGame)
    .filter((g) => g.playtime_forever > 0)
    .sort((a, b) => b.playtime_forever - a.playtime_forever);
}

export function parsePlaytimeRankFromMessage(message: string): number | null {
  const m = normalizeMessage(message);

  const topMatch = m.match(/top\s*(\d+)/i);
  if (topMatch) return parseInt(topMatch[1], 10);

  const digitMatch = m.match(/(\d+)\s*번째/);
  if (digitMatch) return parseInt(digitMatch[1], 10);

  for (const { pattern, rank } of KOREAN_ORDINALS) {
    if (pattern.test(m)) return rank;
  }

  if (/가장\s*많이|제일\s*많이|최다\s*플레이|1\s*등/i.test(m) && /게임|플레이/.test(m)) {
    if (!/\d+\s*번째|두\s*번째|세\s*번째|네\s*번째|다섯|여섯|일곱|여덟|아홉|열\s*번째/.test(m)) {
      return 1;
    }
  }

  return null;
}

/** 전체 성향 보고서 요청 (짧은 Q&A·DB 팩트와 구분) — Orchestrator 폴백용 */
export function isFullAnalysisRequest(message: string): boolean {
  const m = normalizeMessage(message).toLowerCase();
  if (isSpecificSteamFactQuestion(m)) return false;

  return /성향|스타일|게이머|dna|전체|종합|전반|전체적|총평|보고서|나\s*어때|어떤\s*플레이|플레이\s*타입|분석\s*해|분석해\s*줘|분석\s*좀|취향\s*분석/.test(
    m
  );
}

/** N번째·순위·몇 개 등 DB에서 바로 답하는 팩트 질문 */
export function isSpecificSteamFactQuestion(message: string): boolean {
  const m = normalizeMessage(message).toLowerCase();
  if (parsePlaytimeRankFromMessage(m) !== null) return true;

  return (
    /\d+\s*번째|몇\s*번째|몇\s*개\s*(게임|보유)?|게임\s*몇\s*개|보유\s*게임\s*(수|몇)|총\s*플레이|플레이\s*시간\s*(얼마|총|합|몇)|플탐|순위\s*(알려|뭐|어떤)|top\s*\d|상위\s*\d|가장\s*많이\s*한\s*게임|제일\s*많이|라이브러리\s*가격|얼마\s*썼|최근\s*2\s*주/i.test(
      m
    ) && !/전체|종합|전반|성향|스타일|게이머|dna|보고서|나\s*어때/.test(m)
  );
}

export function resolveAnalysisMode(
  message: string,
  orchestratorMode: AnalysisMode | null
): AnalysisMode {
  if (orchestratorMode) return orchestratorMode;
  if (isSpecificSteamFactQuestion(message)) return "qa";
  if (isFullAnalysisRequest(message)) return "full";
  return "qa";
}

/** 내 Steam/DB 데이터를 묻는 질문인지 (Orchestrator보다 우선 라우팅) */
export function isSteamDataQuestion(message: string): boolean {
  const m = normalizeMessage(message).toLowerCase();

  const asksMyData =
    /내\s*(게임|라이브러리|스팀|steam|플레이|데이터|기록)|나의\s*(게임|라이브러리|플레이)|보유\s*게임|플레이\s*시간|플레이타임|플탐|장르|멀티|싱글|최근\s*2\s*주|2\s*주|라이브러리\s*가격|게임\s*몇|몇\s*개|총\s*플레이|얼마\s*썼|순위|많이\s*(한|플레이)|적게\s*한|가장\s*많이|제일\s*많이|top\s*\d|\d+\s*번째|성향|게이머|dna|그래프|동기화|분석/.test(
      m
    );

  if (!asksMyData) return false;

  const pureRecommend =
    /(추천\s*해|뭐\s*할까|어떤\s*게임\s*(좋|할)|비슷한\s*게임)/.test(m) &&
    !/(내|나의|나|플레이\s*시간|순위|번째|보유|라이브러리|몇\s*개|총)/.test(m);

  return !pureRecommend;
}

function parseTopListCount(message: string, max: number): number {
  const m = normalizeMessage(message);
  const topMatch = m.match(/top\s*(\d+)|상위\s*(\d+)|(\d+)\s*개\s*(정도|순위)?/i);
  if (topMatch) {
    const n = parseInt(topMatch[1] ?? topMatch[2] ?? topMatch[3], 10);
    if (n > 0) return Math.min(n, max);
  }
  return 5;
}

function answerRank(games: UserGameRecord[], rank: number): string {
  const rows = getPlaytimeRankedGames(games);
  const total = rows.length;

  if (total === 0) {
    return "플레이 기록이 있는 게임이 없어요. Steam 프로필 게임 세부 정보를 공개한 뒤 대시보드에서 다시 동기화해 주세요.";
  }

  if (rank < 1 || rank > total) {
    return `플레이 기록이 있는 게임은 ${total}개예요. ${rank}번째 순위 게임은 없어요.`;
  }

  const game = rows[rank - 1];
  const name = game.game_name ?? `App ${game.appid}`;
  const hours = formatHoursCasual(game.playtime_forever);

  return `${rank}번째로 많이 플레이한 게임은 「${name}」이에요. (약 ${hours})`;
}

/**
 * DB 데이터로 바로 답할 수 있는 질문이면 답변 문자열 반환.
 * null이면 Agent(JSON+LLM)로 넘김.
 */
export function tryAnswerSteamDataQuestion(
  message: string,
  games: UserGameRecord[]
): string | null {
  const m = normalizeMessage(message);
  const data = buildAnalysisAgentInput(games, "게이머");
  const ranked = getPlaytimeRankedGames(games);

  const rank = parsePlaytimeRankFromMessage(m);
  if (rank !== null) return answerRank(games, rank);

  if (/몇\s*개\s*(게임|보유)|게임\s*몇\s*개|보유\s*게임\s*(수|몇)|총\s*게임/i.test(m)) {
    return `보유 게임은 ${data.total_games}개, 플레이 기록이 있는 게임은 ${ranked.length}개예요.`;
  }

  if (/총\s*플레이|플레이\s*시간\s*(얼마|총|합|몇)|플탐\s*(얼마|총)/i.test(m)) {
    return `총 플레이 시간은 약 ${data.total_playtime}예요.`;
  }

  if (/라이브러리\s*가격|게임\s*값|얼마\s*썼|정가\s*합|가격\s*합/i.test(m)) {
    if (data.total_library_value_krw <= 0) {
      return "라이브러리 가격 정보가 아직 없어요. Steam 다시 동기화 후 확인해 주세요.";
    }
    return `보유 게임 정가 합계는 약 ${formatKrw(data.total_library_value_krw)}예요.`;
  }

  if (/멀티|싱글|혼자|함께|co-op|coop/i.test(m) && /비율|선호|몇\s*percent|%|퍼센트|얼마나|더/.test(m)) {
    return `싱글 ${data.single_play_ratio}%, 멀티 ${data.multi_play_ratio}% 정도로 플레이하셨어요. (플레이 시간 기준)`;
  }

  if (/장르|장르\s*비율|장르\s*분포|무슨\s*장르/i.test(m)) {
    const entries = Object.entries(data.genre_distribution);
    if (entries.length === 0) return "장르 데이터가 아직 없어요.";
    const top = entries.slice(0, 5).map(([genre, pct]) => `${genre} ${pct}`).join(", ");
    return `플레이 시간 기준 주요 장르예요: ${top}`;
  }

  if (/최근\s*2\s*주|2\s*주\s*(동안|간)|요즘\s*(하는|플레이|게임)/i.test(m)) {
    if (data.recent_2weeks_games.length === 0) {
      return "최근 2주 동안 플레이 기록이 없어요.";
    }
    return `최근 2주에 플레이한 게임: ${data.recent_2weeks_games.join(", ")}`;
  }

  if (/가장\s*적게|제일\s*적게|least|적게\s*한\s*게임/i.test(m)) {
    if (!data.least_played_game) return "비교할 플레이 기록이 부족해요.";
    return `1위 게임 다음으로 적게 플레이한 게임은 「${data.least_played_game.name}」이에요. (약 ${data.least_played_game.hours})`;
  }

  if (/가장\s*많이|제일\s*많이|많이\s*한\s*게임|1\s*위\s*게임/i.test(m)) {
    if (!data.most_played_game) return "플레이 기록이 있는 게임이 없어요.";
    return `가장 많이 플레이한 게임은 「${data.most_played_game.name}」이에요. (약 ${data.most_played_game.hours})`;
  }

  if (/순위|top\s*\d|상위\s*\d|플레이\s*순|많이\s*한\s*순/i.test(m)) {
    if (data.top_played_games.length === 0) return "플레이 기록이 있는 게임이 없어요.";
    const count = parseTopListCount(m, data.top_played_games.length);
    const lines = data.top_played_games
      .slice(0, count)
      .map((g) => `${g.rank}위 ${g.name} (${g.hours})`)
      .join("\n");
    return `플레이 시간 순위예요.\n${lines}`;
  }

  return null;
}
