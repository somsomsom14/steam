import { generateText } from "../gemini";
import {
  collectPreviouslyRecommendedAppIds,
  getOwnedAppIds,
  getOwnedNames,
  isMoreRecommendRequest,
  isOwnedGame,
  resolveGameRecommendMode,
  serializeGameRecommendMessage,
  type GameRecommendMode,
} from "../game-recommend-utils";
import { formatTendencyForPrompt, summarizeTopGames, aggregateTagPlaytime } from "../user-tendency";
import { searchSteamStoreAppId } from "@/lib/steam";
import type { ChatHistoryMessage, GameRecommendItem, UserGameRecord } from "../types";

const TARGET_RECOMMEND_COUNT = 2;
const CANDIDATE_COUNT = 4;

const SYSTEM_BASE = `당신은 Steam 게임 추천 전문 Agent입니다.
반드시 아래 JSON 형식만 출력하세요. 다른 텍스트 금지.

{"intro":"한 줄 요약","games":[{"name":"정확한 Steam 스토어 게임명","reason":"추천 이유 1~2문장"}]}

공통 규칙:
- games 배열은 정확히 ${CANDIDATE_COUNT}개 (서로 다른 게임, 우선순위 높은 순)
- name에는 Steam PC 게임의 정확한 상품명만 (appid·URL·이미지 URL 출력 금지)
- [이미 보유] 또는 [이전 추천] 목록의 게임은 절대 포함하지 않음
- intro는 친근한 한국어 한 줄`;

const MODE_INSTRUCTION: Record<GameRecommendMode, string> = {
  preference: `
[추천 모드: 사용자 조건 우선]
- 사용자가 장르·플레이 방식·분위기·난이도 등 구체적 조건을 말했습니다.
- 해당 조건을 최우선으로 게임을 고르세요. 플레이 성향은 참고만 하거나 무시해도 됩니다.
- intro와 reason에 사용자가 원한 조건이 반영됐음을 자연스럽게 언급하세요.`,
  tendency: `
[추천 모드: 성향 기반]
- 사용자가 특별한 조건을 말하지 않았습니다.
- 플레이 성향(태그)·플레이 시간 상위 게임을 기반으로 취향에 맞는 게임을 고르세요.`,
};

type RawRec = { name?: string; reason?: string };

async function resolveOneRecommendation(
  raw: RawRec,
  ownedAppIds: Set<number>,
  ownedNames: Set<string>,
  usedAppIds: Set<number>
): Promise<GameRecommendItem | null> {
  const name = raw.name?.trim();
  const reason = raw.reason?.trim();
  if (!name || !reason) return null;
  if (isOwnedGame(null, name, ownedAppIds, ownedNames)) return null;

  const appid = await searchSteamStoreAppId(name);
  if (!appid || usedAppIds.has(appid) || isOwnedGame(appid, name, ownedAppIds, ownedNames)) {
    return null;
  }

  usedAppIds.add(appid);
  return { appid, name, reason };
}

async function resolveRecommendations(
  rawGames: RawRec[],
  ownedAppIds: Set<number>,
  ownedNames: Set<string>,
  excludeAppIds: Set<number>
): Promise<GameRecommendItem[]> {
  const usedAppIds = new Set<number>([...ownedAppIds, ...excludeAppIds]);
  const results: GameRecommendItem[] = [];

  for (const raw of rawGames) {
    if (results.length >= TARGET_RECOMMEND_COUNT) break;
    const item = await resolveOneRecommendation(raw, ownedAppIds, ownedNames, usedAppIds);
    if (item) results.push(item);
  }

  return results;
}

function parseRecommendJson(raw: string): { intro?: string; games?: RawRec[] } | null {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]) as { intro?: string; games?: RawRec[] };
  } catch {
    return null;
  }
}

function buildPrompt(params: {
  userMessage: string;
  games: UserGameRecord[];
  mode: GameRecommendMode;
  more: boolean;
  extraExcludeNames?: string[];
}): string {
  const ownedList = params.games
    .map((g) => `${g.appid}: ${g.game_name ?? `App ${g.appid}`}`)
    .slice(0, 120)
    .join("\n");

  const tendencies = aggregateTagPlaytime(params.games, 10);
  const tendencyBlock = `[플레이 성향 — 태그별 상위]
${formatTendencyForPrompt(tendencies)}

[플레이 시간 상위 게임]
${summarizeTopGames(params.games)}`;

  const modeNote =
    params.mode === "preference"
      ? "※ 위 성향 데이터는 참고용입니다. 사용자 요청 조건이 더 중요합니다."
      : "※ 위 성향·플레이 기록을 바탕으로 추천하세요.";

  const excludeNames =
    params.extraExcludeNames?.length ?
      `\n[추가 제외 게임명 — 절대 포함 금지]\n${params.extraExcludeNames.join("\n")}`
    : "";

  return `${tendencyBlock}

[이미 보유한 게임 — 추천 금지]
${ownedList || "(없음)"}
${excludeNames}

[사용자 요청]
${params.userMessage}
${params.more ? "\n(이전과 다른 새로운 게임을 추천하세요.)" : ""}

${modeNote}

위 조건을 지켜 JSON만 출력하세요.`;
}

async function generateCandidates(params: {
  userMessage: string;
  games: UserGameRecord[];
  mode: GameRecommendMode;
  more: boolean;
  extraExcludeNames?: string[];
}): Promise<{ intro?: string; games: RawRec[] } | null> {
  const system = `${SYSTEM_BASE}\n${MODE_INSTRUCTION[params.mode]}`;
  const prompt = buildPrompt(params);
  const raw = await generateText(prompt, system);
  const parsed = parseRecommendJson(raw);
  if (!parsed) return null;
  return { intro: parsed.intro, games: parsed.games ?? [] };
}

async function fillRecommendations(params: {
  userMessage: string;
  games: UserGameRecord[];
  history: ChatHistoryMessage[];
  mode: GameRecommendMode;
  more: boolean;
}): Promise<{ intro: string; items: GameRecommendItem[] } | null> {
  const ownedAppIds = getOwnedAppIds(params.games);
  const ownedNames = getOwnedNames(params.games);
  const prevRecommended = collectPreviouslyRecommendedAppIds(params.history);
  const excludeAppIds = new Set([...ownedAppIds, ...prevRecommended]);

  const first = await generateCandidates({
    userMessage: params.userMessage,
    games: params.games,
    mode: params.mode,
    more: params.more,
  });
  if (!first) return null;

  let resolved = await resolveRecommendations(first.games, ownedAppIds, ownedNames, excludeAppIds);

  if (resolved.length < TARGET_RECOMMEND_COUNT) {
    const triedNames = [
      ...first.games.map((g) => g.name?.trim()).filter(Boolean) as string[],
      ...resolved.map((g) => g.name),
    ];

    const retry = await generateCandidates({
      userMessage: params.userMessage,
      games: params.games,
      mode: params.mode,
      more: params.more,
      extraExcludeNames: triedNames,
    });

    if (retry) {
      const extra = await resolveRecommendations(retry.games, ownedAppIds, ownedNames, excludeAppIds);
      const seen = new Set(resolved.map((g) => g.appid));
      for (const item of extra) {
        if (resolved.length >= TARGET_RECOMMEND_COUNT) break;
        if (!seen.has(item.appid)) {
          seen.add(item.appid);
          resolved.push(item);
        }
      }
      if (!first.intro?.trim() && retry.intro?.trim()) {
        first.intro = retry.intro;
      }
    }
  }

  if (resolved.length === 0) return null;

  const intro =
    first.intro?.trim() ||
    (params.more ?
      params.mode === "preference" ?
        "조건에 맞는 다른 게임을 골라봤어요!"
      : "다른 게임 2개를 골라봤어요!"
    : params.mode === "preference" ?
      "말씀하신 조건에 맞는 게임이에요!"
    : "당신 취향에 맞는 게임 2가지예요!");

  return { intro, items: resolved.slice(0, TARGET_RECOMMEND_COUNT) };
}

export async function buildGameRecommendMessage(params: {
  userMessage: string;
  games: UserGameRecord[];
  history: ChatHistoryMessage[];
}): Promise<string> {
  const more = isMoreRecommendRequest(params.userMessage);
  const mode = resolveGameRecommendMode(params.userMessage, params.history);

  const result = await fillRecommendations({
    userMessage: params.userMessage,
    games: params.games,
    history: params.history,
    mode,
    more,
  });

  if (!result) {
    return more ?
        "추가로 추천할 새 게임을 찾지 못했습니다. 다른 장르나 조건으로 다시 물어봐 주세요."
      : "게임 추천을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }

  if (result.items.length < TARGET_RECOMMEND_COUNT) {
    const intro =
      `${result.intro} (조건에 맞는 게임을 ${result.items.length}개만 찾았어요. 다른 조건으로 다시 물어보시면 더 찾아볼게요.)`;
    return serializeGameRecommendMessage(intro, result.items);
  }

  return serializeGameRecommendMessage(result.intro, result.items);
}

export async function* runGameRecommendAgent(params: {
  userMessage: string;
  games: UserGameRecord[];
  history: ChatHistoryMessage[];
}): AsyncGenerator<string> {
  const message = await buildGameRecommendMessage(params);
  yield message;
}
