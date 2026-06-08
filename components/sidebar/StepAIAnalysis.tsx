'use client';

function extractSuggestions(content: string) {
  if (!content.trim()) return [];
  const lines = content
    .split('\n')
    .map((line) => line.replace(/^[-*\d.、#\s]+/, '').trim())
    .filter((line) => line.length > 12);
  return lines.slice(0, 5);
}

export default function StepAIAnalysis({ aiOutput }: { aiOutput: string }) {
  const suggestions = extractSuggestions(aiOutput);

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-white">步骤1：AI分析</h3>
        <p className="mt-1 text-xs text-gray-500">自动读取主页面标记为 data-ai-output 的 AI 生成内容。</p>
      </div>
      <div className="rounded-lg border border-dark-border bg-dark-bg p-3">
        <div className="mb-2 text-xs text-gray-500">AI生成内容标注</div>
        <div className="inline-flex rounded-full bg-primary/15 px-3 py-1 text-xs text-primary">AI生成</div>
      </div>
      {suggestions.length === 0 ? (
        <p className="rounded-lg border border-dark-border bg-dark-bg p-4 text-sm text-gray-400">
          主工作区生成 AI 内容后，这里会自动提取 3-5 条关键建议。
        </p>
      ) : (
        <ol className="space-y-2">
          {suggestions.map((item, index) => (
            <li key={`${item}-${index}`} className="rounded-lg border border-dark-border bg-dark-bg p-3 text-sm text-gray-300">
              <span className="mr-2 text-primary">{index + 1}.</span>
              {item}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

