'use client';

import { useState } from 'react';

type ArtifactKind = 'lesson-design' | 'essay-eval' | 'exam-review';

interface ArtifactRecord {
  id: string;
  kind: ArtifactKind;
  title: string;
}

interface CollaborationPanelProps {
  artifact: ArtifactRecord | null;
}

export default function CollaborationPanel({ artifact }: CollaborationPanelProps) {
  const [teacherDecision, setTeacherDecision] = useState('');
  const [adoptedParts, setAdoptedParts] = useState('');
  const [modifiedParts, setModifiedParts] = useState('');
  const [reflection, setReflection] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const canSubmit = artifact && teacherDecision.trim() && reflection.trim();

  async function handleSubmit() {
    if (!artifact || !canSubmit) return;
    setIsSaving(true);
    setStatus(null);
    try {
      const response = await fetch('/api/collaboration-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artifactId: artifact.id,
          teacherDecision,
          adoptedParts,
          modifiedParts,
          reflection,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '保存失败');

      setStatus('协同记录已保存，可在“协同记录”页面导出查看。');
      setTeacherDecision('');
      setAdoptedParts('');
      setModifiedParts('');
      setReflection('');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '保存失败');
    } finally {
      setIsSaving(false);
    }
  }

  if (!artifact) {
    return (
      <div className="bg-dark-card rounded-xl p-6 border border-dark-border">
        <h2 className="text-lg font-semibold text-white mb-2">教师决策与反思</h2>
        <p className="text-sm text-gray-400">生成并保存 AI 成果后，这里会出现人机协同记录表单。</p>
      </div>
    );
  }

  return (
    <div className="bg-dark-card rounded-xl p-6 border border-dark-border">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-white">教师决策与反思</h2>
        <p className="mt-1 text-sm text-gray-400">
          当前关联成果：<span className="text-primary">{artifact.title}</span>
        </p>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="block text-sm text-gray-300 mb-2">
            AI 的建议与你原本想法有什么不同？你决定如何处理？
          </span>
          <textarea
            value={teacherDecision}
            onChange={(event) => setTeacherDecision(event.target.value)}
            className="w-full h-24 bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            placeholder="例如：AI 建议增加情境导入，我原本只安排词汇复习，决定保留导入并压缩机械操练时间。"
          />
        </label>

        <div className="grid md:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-sm text-gray-300 mb-2">采纳哪些部分</span>
            <textarea
              value={adoptedParts}
              onChange={(event) => setAdoptedParts(event.target.value)}
              className="w-full h-20 bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              placeholder="保留的 AI 建议"
            />
          </label>
          <label className="block">
            <span className="block text-sm text-gray-300 mb-2">修改哪些部分</span>
            <textarea
              value={modifiedParts}
              onChange={(event) => setModifiedParts(event.target.value)}
              className="w-full h-20 bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              placeholder="基于学情做出的调整"
            />
          </label>
        </div>

        <label className="block">
          <span className="block text-sm text-gray-300 mb-2">一两句话反思</span>
          <textarea
            value={reflection}
            onChange={(event) => setReflection(event.target.value)}
            className="w-full h-24 bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            placeholder="例如：学生兴趣不足的问题比我预想更突出，后续要用更贴近生活的输入材料降低写作启动难度。"
          />
        </label>

        <button
          onClick={handleSubmit}
          disabled={!canSubmit || isSaving}
          className="w-full py-3 bg-secondary hover:bg-secondary/90 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
        >
          {isSaving ? '保存中...' : '保存人机协同记录'}
        </button>

        {status && (
          <div className="text-sm text-gray-300 bg-dark-bg border border-dark-border rounded-lg px-4 py-3">
            {status}
          </div>
        )}
      </div>
    </div>
  );
}

