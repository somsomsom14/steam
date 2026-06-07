import { GoogleGenerativeAI, type Content, type GenerativeModel } from "@google/generative-ai";
import type { ChatHistoryMessage } from "./types";

/** 고정 모델 (2.5 계열 오류 회피) */
const GEMINI_MODEL_ID = "gemini-1.5-flash";
const API_TIMEOUT_MS = 45_000;

export function getGeminiModelChain(): string[] {
  return [GEMINI_MODEL_ID];
}

export const GEMINI_MODEL = GEMINI_MODEL_ID;

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.");
  return new GoogleGenerativeAI(apiKey);
}

function getModelFor(modelName: string, systemInstruction?: string): GenerativeModel {
  return getClient().getGenerativeModel({
    model: modelName,
    ...(systemInstruction ? { systemInstruction } : {}),
  });
}

export function getModel(systemInstruction?: string) {
  return getModelFor(GEMINI_MODEL, systemInstruction);
}

function toGeminiHistory(history: ChatHistoryMessage[]): Content[] {
  return history.map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.content }],
  }));
}

function isQuotaError(raw: string): boolean {
  return raw.includes("429") || /quota|rate.?limit/i.test(raw);
}

function isDailyQuotaError(raw: string): boolean {
  return /PerDay|RPD|daily|GenerateRequestsPerDay/i.test(raw);
}

function isModelUnavailable(raw: string): boolean {
  return /404|not found|not supported|invalid model/i.test(raw);
}

function isRetryableModelError(raw: string): boolean {
  return isQuotaError(raw) || isModelUnavailable(raw);
}

/** Google API 오류 → 사용자용 한국어 메시지 */
export function toUserFacingGeminiError(err: unknown, model?: string): Error {
  const raw = err instanceof Error ? err.message : String(err);
  const modelNote = model ? `\n(시도 모델: ${model})` : "";

  if (raw.includes("시간이 초과")) {
    return new Error(`${raw}${modelNote}`);
  }

  if (isQuotaError(raw)) {
    if (isDailyQuotaError(raw)) {
      return new Error(
        `오늘 AI 무료 사용량(일일 한도)을 모두 사용했습니다.${modelNote}\n` +
          `내일 다시 시도하거나 Google AI Studio(https://aistudio.google.com/)에서 사용량·요금제를 확인해 주세요.`
      );
    }

    return new Error(
      `AI 요청이 너무 많습니다. 1~2분 후 다시 시도해 주세요.${modelNote}\n` +
        `(무료 플랜은 분당 요청 수 제한이 있습니다.)`
    );
  }

  if (isModelUnavailable(raw)) {
    return new Error(
      `설정된 AI 모델(${GEMINI_MODEL_ID})을 사용할 수 없습니다.${modelNote}\n` +
        `Google AI Studio에서 API 키와 모델 사용 가능 여부를 확인해 주세요.`
    );
  }

  if (raw.includes("API key not valid") || raw.includes("API_KEY_INVALID")) {
    return new Error("GEMINI_API_KEY가 올바르지 않습니다. Google AI Studio에서 키를 확인해 주세요.");
  }

  if (raw.includes("GEMINI_API_KEY")) return new Error(raw);

  if (process.env.NODE_ENV === "development") {
    return new Error(`AI 오류: ${raw.slice(0, 280)}${modelNote}`);
  }

  return new Error("AI 응답 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
}

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function withModelFallback<T>(fn: (modelName: string) => Promise<T>): Promise<T> {
  const models = getGeminiModelChain();
  const errors: string[] = [];

  for (let i = 0; i < models.length; i++) {
    const modelName = models[i];
    try {
      return await withTimeout(
        fn(modelName),
        API_TIMEOUT_MS,
        "AI 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요."
      );
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      errors.push(`${modelName}: ${raw.slice(0, 120)}`);
      if (!isRetryableModelError(raw) || i === models.length - 1) {
        const combined = errors.join(" | ");
        const preferQuota = errors.some((e) => isQuotaError(e));
        throw new Error(preferQuota ? errors.find((e) => isQuotaError(e))! : combined);
      }
    }
  }

  throw new Error("AI 모델을 사용할 수 없습니다.");
}

/** 단발 생성 */
export async function generateText(prompt: string, systemInstruction?: string): Promise<string> {
  return withModelFallback(async (modelName) => {
    const model = getModelFor(modelName, systemInstruction);
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  });
}

/** 스트리밍 생성 — 대화 히스토리 포함 */
export async function* streamChatResponse(params: {
  systemInstruction: string;
  userPrompt: string;
  history?: ChatHistoryMessage[];
}): AsyncGenerator<string> {
  let result;
  try {
    result = await withModelFallback(async (modelName) => {
      const model = getModelFor(modelName, params.systemInstruction);
      const history = params.history?.length ? toGeminiHistory(params.history) : [];
      const chat = model.startChat({ history });
      return chat.sendMessageStream(params.userPrompt);
    });
  } catch (err) {
    throw toUserFacingGeminiError(err, GEMINI_MODEL);
  }

  try {
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield text;
    }
  } catch (err) {
    throw toUserFacingGeminiError(err, GEMINI_MODEL);
  }
}
