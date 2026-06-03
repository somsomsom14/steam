import { generateText } from "./gemini";
import type { ChatHistoryMessage, ChatIntent } from "./types";

const INTENT_LABELS: ChatIntent[] = ["게임추천", "방추천", "성향분석", "일반문의"];

const CLASSIFY_SYSTEM = `당신은 MI-TEAM 게이머 커뮤니티의 Orchestrator입니다.
사용자 메시지를 읽고 intent를 정확히 하나만 분류합니다.

분류 규칙:
- [게임추천]: 게임 추천, 어떤 게임 할지, 맞는 게임, 비슷한 게임, 장르 추천 등
- [방추천]: 방 추천, 같이 할 방, 들어갈 방, 팀/파티 찾기 등
- [성향분석]: 내 성향, 어떤 게이머, Steam DNA, 플레이 스타일 분석 등
- [일반문의]: 위에 해당하지 않는 모든 질문 (사이트 이용, 동기화 오류, 버그, 인사 등)

반드시 JSON만 출력: {"intent":"게임추천"} 형식. intent 값은 게임추천|방추천|성향분석|일반문의 중 하나.`;

function parseIntent(raw: string): ChatIntent {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as { intent?: string };
      if (parsed.intent && INTENT_LABELS.includes(parsed.intent as ChatIntent)) {
        return parsed.intent as ChatIntent;
      }
    }
  } catch {
    /* fallback */
  }

  const lower = raw.toLowerCase();
  if (/게임추천|게임 추천/.test(lower)) return "게임추천";
  if (/방추천|방 추천/.test(lower)) return "방추천";
  if (/성향분석|성향 분석/.test(lower)) return "성향분석";
  return "일반문의";
}

/** 키워드 기반 빠른 분류 (API 실패 시) */
function keywordFallback(message: string): ChatIntent {
  const m = message.toLowerCase();
  if (/게임.*(추천|추천해|뭐할|할까|맞는|비슷한)|추천.*게임|어떤 게임/.test(m)) return "게임추천";
  if (/방.*(추천|찾|들어|같이)|추천.*방|파티|팀.*찾/.test(m)) return "방추천";
  if (/성향|게이머|dna|플레이.*스타일|분석해|어떤.*플레이/.test(m)) return "성향분석";
  return "일반문의";
}

export async function classifyIntent(
  userMessage: string,
  recentHistory: ChatHistoryMessage[]
): Promise<ChatIntent> {
  const historySnippet = recentHistory
    .slice(-4)
    .map((h) => `${h.role}: ${h.content.slice(0, 120)}`)
    .join("\n");

  const prompt = `최근 대화:\n${historySnippet || "(없음)"}\n\n현재 사용자 메시지:\n${userMessage}`;

  try {
    const raw = await generateText(prompt, CLASSIFY_SYSTEM);
    return parseIntent(raw);
  } catch {
    return keywordFallback(userMessage);
  }
}

export const GENERAL_INQUIRY_SYSTEM = `당신은 MI-TEAM AI 문의방의 안내 도우미입니다.
한국어로 친절하고 간결하게 답변합니다.

다음 주제(데이터 미표시, 그래프 없음, 게임 목록 안 불러짐, 분석된 게임 없음 등)에 대해 질문하면 반드시 아래 안내를 포함하세요:

---
Steam 설정을 확인해 주세요.
Steam 프로필 → 프로필 편집 → 개인 정보 설정 → 게임 세부 정보: 공개
공개로 변경한 뒤 대시보드에서 「Steam 다시 동기화」를 진행해 주세요.
---

그 외 일반 질문에는 MI-TEAM 서비스(대시보드 플레이 분석, 방 찾기, 팀 매칭) 맥락에서 도움을 줍니다.
게임 추천·방 추천·성향 분석은 전용 기능으로도 가능하다고 안내할 수 있습니다.`;
