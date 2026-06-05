import {
  hasAnalysisSections,
  parseAnalysisContent,
} from "@/lib/ai/analysis-format";

type Props = {
  content: string;
};

export function AnalysisMessageBody({ content }: Props) {
  if (!hasAnalysisSections(content)) {
    return <p className="ai-chat-bubble__text">{content}</p>;
  }

  const blocks = parseAnalysisContent(content);

  return (
    <div className="ai-analysis-body">
      {blocks.map((block, i) => {
        if (block.type === "heading") {
          const mod =
            block.section >= 1 && block.section <= 3
              ? `ai-analysis-section--${block.section}`
              : "ai-analysis-section--default";
          return (
            <h3 key={i} className={`ai-analysis-section ${mod}`}>
              {block.content}
            </h3>
          );
        }
        if (block.type === "footline") {
          return (
            <p key={i} className="ai-analysis-footline">
              {block.content}
            </p>
          );
        }
        return (
          <p key={i} className="ai-analysis-section__text">
            {block.content}
          </p>
        );
      })}
    </div>
  );
}
