import { generateText } from "./gemini";
import type { ChatHistoryMessage, ChatIntent } from "./types";

export const ORCHESTRATOR_SYSTEM = `당신은 MI-TEAM AI 상담소의 Orchestrator입니다.

유저 메시지를 읽고 반드시 첫 줄에 아래 태그 중 하나만 출력하세요.

[게임추천]
[방추천]
[성향분석]
[일반문의]

분류 기준:
- 게임 추천해줘, 어떤 게임 할까, 나한테 맞는 게임 알려줘 → [게임추천]
- 방 추천해줘, 어떤 방 들어갈까, 같이 할 방 찾아줘 → [방추천]
- 내 성향 알려줘, 나 어떤 게이머야, 내 Steam DNA 설명해줘 → [성향분석]
- 그 외 모든 질문 → [일반문의]

[일반문의]인 경우에는 두 번째 줄부터 친절하게 답변하세요.

Steam 데이터 관련 문의:
- 분석된 게임이 없어요
- 그래프가 안 나와요
- 게임 목록이 안 불러와요
- 데이터가 이상해요

위 질문에는 아래 내용을 안내하세요.

Steam 프로필 → 프로필 편집 → 개인 정보 설정 → 게임 세부 정보: 공개

공개로 변경한 뒤 대시보드에서 Steam 다시 동기화를 진행해 주세요.

주의:
- 첫 줄에는 반드시 태그만 출력하세요.
- 마크다운은 사용하지 마세요.
- 답변은 한국어로 작성하세요.`;

const TAG_TO_INTENT: Record<string, ChatIntent> = {
  "[게임추천]": "게임추천",
  "[방추천]": "방추천",
  "[성향분석]": "성향분석",
  "[일반문의]": "일반문의",
};

export type OrchestratorResult = {
  intent: ChatIntent;
  /** [일반문의]일 때 Orchestrator가 생성한 본문 (태그 제외) */
  generalReply: string | null;
};

/** 키워드 분류 — API 실패·파싱 실패 시 폴백 */
export function keywordClassify(message: string): ChatIntent | null {
  const m = message.trim().toLowerCase();
  if (/^더 추천받기$|더 추천|다른 게임 추천/.test(m)) return "게임추천";
  if (/게임.*(추천|추천해|뭐할|할까|맞는|비슷한)|추천.*게임|어떤 게임/.test(m)) return "게임추천";
  if (/방.*(추천|찾|들어|같이)|추천.*방|파티|팀.*찾/.test(m)) return "방추천";
  if (/성향|게이머|dna|플레이.*스타일|분석해|어떤.*플레이|게임스타일/.test(m)) return "성향분석";
  return null;
}

export function parseOrchestratorResponse(raw: string): OrchestratorResult {
  const trimmed = raw.trim();
  const lines = trimmed.split(/\r?\n/);
  const firstLine = lines[0]?.trim() ?? "";

  let intent: ChatIntent | null = null;
  for (const [tag, label] of Object.entries(TAG_TO_INTENT)) {
    if (firstLine === tag || firstLine.startsWith(tag)) {
      intent = label;
      break;
    }
  }

  if (!intent) {
    const tagInLine = firstLine.match(/\[(게임추천|방추천|성향분석|일반문의)\]/);
    if (tagInLine) intent = tagInLine[1] as ChatIntent;
  }

  if (!intent) intent = keywordClassify(trimmed) ?? "일반문의";

  const body = lines.slice(1).join("\n").trim();

  return {
    intent,
    generalReply: intent === "일반문의" ? body || null : null,
  };
}

/** Gemini Orchestrator — 분류 + [일반문의] 시 답변까지 한 번에 생성 */
export async function runOrchestrator(
  userMessage: string,
  history: ChatHistoryMessage[]
): Promise<OrchestratorResult> {
  const historySnippet = history
    .slice(-6)
    .map((h) => `${h.role}: ${h.content.slice(0, 200)}`)
    .join("\n");

  const prompt = historySnippet
    ? `최근 대화:\n${historySnippet}\n\n현재 사용자 메시지:\n${userMessage}`
    : userMessage;

  try {
    const raw = await generateText(prompt, ORCHESTRATOR_SYSTEM);
    return parseOrchestratorResponse(raw);
  } catch {
    const intent = keywordClassify(userMessage) ?? "일반문의";
    return { intent, generalReply: null };
  }
}
