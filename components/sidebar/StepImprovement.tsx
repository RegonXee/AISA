'use client';

import { useState } from 'react';

interface ArtifactRecord {
  id: string;
  kind: 'lesson-design' | 'essay-eval' | 'exam-review';
  title: string;
}

export default function StepImprovement({
  artifact,
  onSaved,
}: {
  artifact: ArtifactRecord | null;
  onSaved?: () => void;
}) {
  const [problem, setProblem] = useState('');
  const [actionPlan, setActionPlan] = useState('');
  const [nextEvidenceDate, setNextEvidenceDate] = useState('');
  const [targetMetric, setTargetMetric] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [status, setStatus] = useState('');

  async function createTask() {
    setStatus('');
    try {
      const response = await fetch('/api/improvement-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceArtifactId: artifact?.id,
          sourceArtifactKind: artifact?.kind,
          problem,
          actionPlan,
          nextEvidenceDate,
          targetMetric,
          targetValue: Number(targetValue),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '创建失败');
      setStatus('改进任务已创建，可在步骤4录入再证据。');
      onSaved?.();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '创建失败');
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-white">步骤3：实施改进</h3>
        <p className="mt-1 text-xs text-gray-500">把诊断结论转成可执行任务和下次证据采集计划。</p>
      </div>
      <textarea value={problem} onChange={(event) => setProblem(event.target.value)} placeholder="问题，例如：学生不能解释文本主题意义" className="h-24 w-full resize-none rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-sm text-gray-100 placeholder-gray-500" />
      <textarea value={actionPlan} onChange={(event) => setActionPlan(event.target.value)} placeholder="行动计划，例如：增加证据链阅读活动" className="h-32 w-full resize-none rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-sm text-gray-100 placeholder-gray-500" />
      <div className="grid grid-cols-3 gap-2">
        <input type="date" value={nextEvidenceDate} onChange={(event) => setNextEvidenceDate(event.target.value)} className="rounded-lg border border-dark-border bg-dark-bg px-2 py-2 text-xs text-gray-100" />
        <input value={targetMetric} onChange={(event) => setTargetMetric(event.target.value)} placeholder="目标指标" className="rounded-lg border border-dark-border bg-dark-bg px-2 py-2 text-xs text-gray-100 placeholder-gray-500" />
        <input type="number" value={targetValue} onChange={(event) => setTargetValue(event.target.value)} placeholder="目标值" className="rounded-lg border border-dark-border bg-dark-bg px-2 py-2 text-xs text-gray-100 placeholder-gray-500" />
      </div>
      <button onClick={createTask} disabled={!problem.trim() || !actionPlan.trim() || !nextEvidenceDate || !targetMetric.trim() || !targetValue.trim()} className="w-full rounded-lg bg-secondary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-secondary/90 disabled:bg-gray-600">
        创建改进任务
      </button>
      {status && <p className="rounded-lg border border-dark-border bg-dark-bg p-3 text-xs text-gray-300">{status}</p>}
    </section>
  );
}
