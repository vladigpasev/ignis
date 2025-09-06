"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeSanitize from "rehype-sanitize";

export default function Markdown({ content, className }: { content: string; className?: string }) {
  return (
    <div className={className || "leading-relaxed text-sm break-words"}>
      <ReactMarkdown
        // GitHub-flavored Markdown and soft line breaks
        remarkPlugins={[remarkGfm, remarkBreaks]}
        // Sanitize to prevent XSS
        rehypePlugins={[rehypeSanitize]}
        // Basic element styling via components where useful
        components={{
          a: (props: any) => (
            <a {...props} className="underline underline-offset-2 text-blue-600 hover:text-blue-700" target="_blank" rel="noreferrer" />
          ),
          code: (allProps: any) => {
            const { inline, className, children, ...props } = allProps || {};
            return inline ? (
              <code className="px-1 py-0.5 rounded bg-muted text-foreground/90" {...props}>{children}</code>
            ) : (
              <pre className="p-3 rounded bg-muted overflow-x-auto"><code className={className} {...props}>{children}</code></pre>
            );
          },
          ul: (props) => <ul className="list-disc pl-5 my-2 space-y-1" {...props} />,
          ol: (props) => <ol className="list-decimal pl-5 my-2 space-y-1" {...props} />,
          blockquote: (props) => <blockquote className="border-l-2 pl-3 text-foreground/80 italic my-2" {...props} />,
          h1: (props) => <h1 className="text-lg font-semibold mt-2" {...props} />,
          h2: (props) => <h2 className="text-base font-semibold mt-2" {...props} />,
          h3: (props) => <h3 className="text-sm font-semibold mt-2" {...props} />,
          p: (props) => <p className="my-2" {...props} />,
          table: (props) => (
            <div className="overflow-x-auto my-2">
              <table className="border-collapse w-full text-sm" {...props} />
            </div>
          ),
          th: (props) => <th className="border px-2 py-1 bg-muted/50" {...props} />,
          td: (props) => <td className="border px-2 py-1" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
