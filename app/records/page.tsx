'use client';

import { useEffect, useMemo, useState } from 'react';

interface CollaborationLog {
  id: string;
  artifactKind: string;
  artifactTitle: string;
  aiSuggestionSummary: string;
  teacherDecision: string;
  adoptedParts: string;
  modifiedParts: string;
  reflection: string;
  createdAt: string;
}

function kindLabel(kind: string) {
  const labels: Record<string, string> = {
    'lesson-design': '教学设计',
    'essay-eval': '作文评价',
    'exam-review': '试卷讲评',
  };
  return labels[kind] || kind;
}

export default function RecordsPage() {
  const [logs, setLogs] = useState<CollaborationLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function loadLogs() {
    setIsLoading(true);
    const response = await fetch('/api/collaboration-logs');
    const data = await response.json();
    setLogs(data.logs || []);
    setIsLoading(false);
  }

  useEffect(() => {
    loadLogs();
  }, []);

  const exportMarkdown = useMemo(() => {
    const rows = logs.map((log, index) => `| ${index + 1} | ${new Date(log.createdAt).toLocaleString('zh-CN')} | ${kindLabel(log.artifactKind)} | ${log.artifactTitle} | ${log.aiSuggestionSummary.replace(/\|/g, '/')} | ${log.teacherDecision.replace(/\|/g, '/')} | ${log.reflection.replace(/\|/g, '/')} |`);
    return `# 人机协同记录表

| 序号 | 时间 | 场景 | AI成果 | AI建议摘要 | 教师决策 | 反思理由 |
|---|---|---|---|---|---|---|
${rows.join('\n') || '| - | - | - | - | - | - | - |'}`;
  }, [logs]);

  function downloadMarkdown() {
    const blob = new Blob([exportMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = '人机协同记录表.md';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">协同记录</h1>
          <p className="text-gray-400">汇总 AI 建议、教师决策和反思理由，可直接用于案例实施过程材料。</p>
        </div>
        <button onClick={downloadMarkdown} className="px-5 py-3 bg-primary hover:bg-primary/90 text-white font-semibold rounded-lg transition-colors">
          导出记录表
        </button>
      </div>

      {isLoading ? (
        <div className="text-gray-400">正在读取记录...</div>
      ) : logs.length === 0 ? (
        <div className="bg-dark-card border border-dark-border rounded-xl p-8 text-gray-400">
          暂无协同记录。请先在教学设计、作文评价或试卷讲评页面生成成果，并填写教师决策与反思。
        </div>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => (
            <article key={log.id} className="bg-dark-card border border-dark-border rounded-xl p-6">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="px-3 py-1 bg-primary/15 text-primary rounded-full text-sm">{kindLabel(log.artifactKind)}</span>
                <h2 className="text-xl font-bold text-white">{log.artifactTitle}</h2>
                <span className="text-sm text-gray-500">{new Date(log.createdAt).toLocaleString('zh-CN')}</span>
              </div>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="bg-dark-bg border border-dark-border rounded-lg p-4">
                  <div className="text-gray-500 mb-2">AI 建议摘要</div>
                  <p className="text-gray-300 leading-relaxed">{log.aiSuggestionSummary}</p>
                </div>
                <div className="bg-dark-bg border border-dark-border rounded-lg p-4">
                  <div className="text-gray-500 mb-2">教师决策</div>
                  <p className="text-gray-300 leading-relaxed">{log.teacherDecision}</p>
                </div>
                <div className="bg-dark-bg border border-dark-border rounded-lg p-4">
                  <div className="text-gray-500 mb-2">采纳/修改</div>
                  <p className="text-gray-300 leading-relaxed">采纳：{log.adoptedParts || '未填写'}</p>
                  <p className="text-gray-300 leading-relaxed mt-2">修改：{log.modifiedParts || '未填写'}</p>
                </div>
                <div className="bg-dark-bg border border-dark-border rounded-lg p-4">
                  <div className="text-gray-500 mb-2">反思理由</div>
                  <p className="text-gray-300 leading-relaxed">{log.reflection}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

