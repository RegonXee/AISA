'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="relative group">
      <div className="markdown-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => <h1 className="text-2xl font-bold text-white mt-6 mb-4 first:mt-0">{children}</h1>,
            h2: ({ children }) => <h2 className="text-xl font-bold text-white mt-5 mb-3">{children}</h2>,
            h3: ({ children }) => <h3 className="text-lg font-semibold text-white mt-4 mb-2">{children}</h3>,
            h4: ({ children }) => <h4 className="text-base font-semibold text-white mt-3 mb-2">{children}</h4>,
            p: ({ children }) => <p className="text-gray-300 mb-4 leading-relaxed">{children}</p>,
            ul: ({ children }) => <ul className="list-disc list-inside text-gray-300 mb-4 space-y-1">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal list-inside text-gray-300 mb-4 space-y-1">{children}</ol>,
            li: ({ children }) => <li className="text-gray-300">{children}</li>,
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-primary pl-4 my-4 text-gray-400 italic">{children}</blockquote>
            ),
            code: ({ className, children, ...props }) => {
              const isInline = !className;
              if (isInline) {
                return (
                  <code className="bg-dark-bg px-1.5 py-0.5 rounded text-primary text-sm font-mono" {...props}>
                    {children}
                  </code>
                );
              }
              return (
                <code className="block bg-dark-bg p-4 rounded-lg overflow-x-auto text-sm font-mono text-gray-300 my-4" {...props}>
                  {children}
                </code>
              );
            },
            pre: ({ children }) => <pre className="bg-dark-bg p-4 rounded-lg overflow-x-auto my-4 border border-dark-border">{children}</pre>,
            table: ({ children }) => (
              <div className="overflow-x-auto my-4">
                <table className="min-w-full border border-dark-border rounded-lg overflow-hidden">{children}</table>
              </div>
            ),
            thead: ({ children }) => <thead className="bg-dark-card">{children}</thead>,
            tbody: ({ children }) => <tbody className="divide-y divide-dark-border">{children}</tbody>,
            tr: ({ children }) => <tr className="hover:bg-dark-card/50 transition-colors">{children}</tr>,
            th: ({ children }) => <th className="px-4 py-3 text-left text-sm font-semibold text-white">{children}</th>,
            td: ({ children }) => <td className="px-4 py-3 text-sm text-gray-300">{children}</td>,
            a: ({ href, children }) => (
              <a href={href} className="text-primary hover:text-primary/80 underline" target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ),
            hr: () => <hr className="border-dark-border my-6" />,
            strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
            em: ({ children }) => <em className="italic text-gray-300">{children}</em>,
          }}
        >
          {content}
        </ReactMarkdown>
      </div>

      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-dark-card hover:bg-dark-border px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white"
      >
        {copied ? '已复制' : '复制'}
      </button>
    </div>
  );
}

