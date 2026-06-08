'use client';

import { useState } from 'react';

interface ArtifactRecord {
  id: string;
  kind: 'lesson-design' | 'essay-eval' | 'exam-review';
  title: string;
}

export default function StepDecision({
  artifact,
  onSaved,
}: {
  artifact: ArtifactRecord | null;
  onSaved?: () => void;
}) {
  const [decision, setDecision] = useState('');
  const [adopted, setAdopted] = useState('');
  const [modified, setModified] = useState('');
  const [reflection, setReflection] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!artifact) {
      setStatus('当前是基于教材图片生成的示例决策。主工作区生成一次 AI 成果后，可将它正式保存为协同记录。');
      return;
    }

    setSaving(true);
    setStatus('');
    try {
      const response = await fetch('/api/collaboration-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artifactId: artifact.id,
          teacherDecision: decision,
          adoptedParts: adopted,
          modifiedParts: modified,
          reflection,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '保存失败');
      setStatus('教师决策与反思已保存。');
      onSaved?.();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-white">步骤2：我的决策</h3>
        <p className="mt-1 text-xs text-gray-500">记录采纳、修改或拒绝 AI 建议的理由。</p>
      </div>
      <textarea value={decision} onChange={(event) => setDecision(event.target.value)} placeholder="AI 建议与你原本想法有什么不同？你如何决策？" className="h-28 w-full resize-none rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-sm text-gray-100 placeholder-gray-500" />
      <div className="grid grid-cols-2 gap-2">
        <textarea value={adopted} onChange={(event) => setAdopted(event.target.value)} placeholder="采纳部分" className="h-24 w-full resize-none rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-sm text-gray-100 placeholder-gray-500" />
        <textarea value={modified} onChange={(event) => setModified(event.target.value)} placeholder="修改/拒绝部分" className="h-24 w-full resize-none rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-sm text-gray-100 placeholder-gray-500" />
      </div>
      <textarea value={reflection} onChange={(event) => setReflection(event.target.value)} placeholder="一两句话写下教学反思" className="h-20 w-full resize-none rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-sm text-gray-100 placeholder-gray-500" />
      <button onClick={save} disabled={saving || !decision.trim() || !reflection.trim()} className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:bg-gray-600">
        {saving ? '保存中...' : '保存决策记录'}
      </button>
      {status && <p className="rounded-lg border border-dark-border bg-dark-bg p-3 text-xs text-gray-300">{status}</p>}
    </section>
  );
}
