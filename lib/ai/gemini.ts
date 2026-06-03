import { GoogleGenerativeAI, type Content } from "@google/generative-ai";
import type { ChatHistoryMessage } from "./types";

export const GEMINI_MODEL = "gemini-2.5-flash";

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.");
  return new GoogleGenerativeAI(apiKey);
}

export function getModel(systemInstruction?: string) {
  return getClient().getGenerativeModel({
    model: GEMINI_MODEL,
    ...(systemInstruction ? { systemInstruction } : {}),
  });
}

function toGeminiHistory(history: ChatHistoryMessage[]): Content[] {
  return history.map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.content }],
  }));
}

/** 단발 생성 (intent 분류 등) */
export async function generateText(prompt: string, systemInstruction?: string): Promise<string> {
  const model = getModel(systemInstruction);
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

/** 스트리밍 생성 — 대화 히스토리 포함 */
export async function* streamChatResponse(params: {
  systemInstruction: string;
  userPrompt: string;
  history?: ChatHistoryMessage[];
}): AsyncGenerator<string> {
  const model = getModel(params.systemInstruction);
  const history = params.history?.length ? toGeminiHistory(params.history) : [];

  const chat = model.startChat({ history });
  const result = await chat.sendMessageStream(params.userPrompt);

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}
