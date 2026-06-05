export type AnalysisBlock =
  | { type: "heading"; content: string; section: number }
  | { type: "text"; content: string }
  | { type: "footline"; content: string };

const SECTION_LINE = /^\d+\.\s+.+/;
const DIVIDER_LINE = /^=+\s*$/;
const FOOTLINE_LINE = /^종합하자면/i;

/** 성향 분석 보고서 섹션 제목·본문 블록으로 분리 */
export function parseAnalysisContent(text: string): AnalysisBlock[] {
  const lines = text.split("\n");
  const blocks: AnalysisBlock[] = [];
  let buffer: string[] = [];

  const flushText = () => {
    const joined = buffer.join("\n").trim();
    buffer = [];
    if (!joined) return;
    if (FOOTLINE_LINE.test(joined.split("\n")[0]?.trim() ?? "")) {
      blocks.push({ type: "footline", content: joined });
    } else {
      blocks.push({ type: "text", content: joined });
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim() || DIVIDER_LINE.test(line.trim())) {
      if (buffer.length) flushText();
      continue;
    }
    const trimmed = line.trim();
    if (SECTION_LINE.test(trimmed)) {
      flushText();
      const num = parseInt(trimmed.match(/^(\d+)/)?.[1] ?? "0", 10);
      blocks.push({
        type: "heading",
        content: trimmed,
        section: num >= 1 && num <= 9 ? num : 0,
      });
      continue;
    }
    buffer.push(line);
  }
  flushText();
  return blocks;
}

export function hasAnalysisSections(text: string): boolean {
  return /^\d+\.\s+.+$/m.test(text);
}
