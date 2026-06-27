// StructuredSolutionPreview - Renders pasted HTML/text in a readable structured format.

import { parseHtmlContent } from '../utils/htmlFormatter';

interface StructuredSolutionPreviewProps {
  content: string;
  title?: string;
}

export default function StructuredSolutionPreview({
  content,
  title,
}: StructuredSolutionPreviewProps) {
  const parsed = parseHtmlContent(content);

  if (!content.trim()) {
    return (
      <div className="h-full flex items-center justify-center text-white/20 text-sm text-center px-6">
        مفيش محتوى للمعاينة لسه
      </div>
    );
  }

  if (parsed.qaPairs.length > 0) {
    return (
      <div className="h-full overflow-y-auto px-4 py-3 space-y-3">
        {title && <div className="text-white/30 text-[11px] font-medium">{title}</div>}
        {parsed.qaPairs.map((pair, index) => (
          <div
            key={`${pair.question}-${index}`}
            className="rounded-xl bg-white/[0.03] border border-white/8 p-3"
          >
            <div className="text-cyan-300 text-xs font-bold mb-1.5 leading-6">
              {pair.question}
            </div>
            <div className="text-white/85 text-sm leading-7 break-words">
              {pair.answer}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-3">
      {title && <div className="text-white/30 text-[11px] font-medium mb-3">{title}</div>}
      <div className="space-y-2">
        {parsed.lines.length > 0 ? (
          parsed.lines.map((line, index) => (
            <div
              key={`${line}-${index}`}
              className="rounded-lg bg-white/[0.025] border border-white/5 px-3 py-2 text-white/80 text-sm leading-7 break-words"
            >
              {line}
            </div>
          ))
        ) : (
          <pre className="text-white/75 text-sm whitespace-pre-wrap leading-7">
            {parsed.plainText}
          </pre>
        )}
      </div>
    </div>
  );
}
