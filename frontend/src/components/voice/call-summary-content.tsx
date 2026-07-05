import ReactMarkdown from "react-markdown";

function normalizeSummaryMarkdown(summary: string): string {
  return summary.replace(/([^\n])\n([*-] \*\*)/g, "$1\n\n$2");
}

export function CallSummaryContent({ summary }: { summary: string }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <p className="mb-3 text-sm text-foreground last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="mt-1 list-disc space-y-2.5 pl-5">{children}</ul>,
        ol: ({ children }) => <ol className="mt-1 list-decimal space-y-2.5 pl-5">{children}</ol>,
        li: ({ children }) => <li className="text-sm leading-relaxed">{children}</li>,
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
      }}
    >
      {normalizeSummaryMarkdown(summary)}
    </ReactMarkdown>
  );
}
