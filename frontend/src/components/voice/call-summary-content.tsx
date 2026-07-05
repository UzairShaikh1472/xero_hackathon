import ReactMarkdown from "react-markdown";

export function CallSummaryContent({ summary }: { summary: string }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <p className="mb-3 text-sm text-foreground last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="mt-2 list-disc space-y-2 pl-5">{children}</ul>,
        ol: ({ children }) => <ol className="mt-2 list-decimal space-y-2 pl-5">{children}</ol>,
        li: ({ children }) => <li className="text-sm leading-relaxed">{children}</li>,
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
      }}
    >
      {summary}
    </ReactMarkdown>
  );
}
