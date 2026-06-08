'use client';

import { useEffect, useState } from 'react';

interface Task {
  id: string;
  problem: string;
  targetMetric: string;
  targetValue: number;
  evidence: { id: string; label: string; metricValue: number }[];
}

export default function StepVerification({ refreshKey = 0 }: { refreshKey?: number }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskId, setTaskId] = useState('');
  const [label, setLabel] = useState('');
  const [metricValue, setMetricValue] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState('');

  async function loadTasks() {
    try {
      const response = await fetch('/api/improvement-tasks');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '读取改进任务失败');
      setTasks(data.tasks || []);
      setStatus('');
    } catch (error) {
      setTasks([]);
      setStatus(error instanceof Error ? error.message : '读取改进任务失败');
    }
  }

  useEffect(() => {
    loadTasks();
  }, [refreshKey]);

  async function addEvidence() {
    if (!taskId) return setStatus('请先选择一个改进任务。');
    setStatus('');
    const task = tasks.find((item) => item.id === taskId);
    try {
      const response = await fetch('/api/improvement-tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add-evidence',
          taskId,
          label,
          metricName: task?.targetMetric || '主题表达达成率',
          metricValue: Number(metricValue),
          note,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '保存失败');
      setStatus('再证据已保存，已更新前后对比。');
      await loadTasks();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '保存失败');
    }
  }

  const selected = tasks.find((task) => task.id === taskId);
  const bars = selected ? [{ id: 'target', label: '目标', metricValue: selected.targetValue }, ...selected.evidence] : [];

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-white">步骤4：验证成效</h3>
        <p className="mt-1 text-xs text-gray-500">上传新的作文分析或小题分结果，形成前后对比。</p>
      </div>
      <select value={taskId} onChange={(event) => setTaskId(event.target.value)} className="w-full rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-sm text-gray-100">
        <option value="">选择改进任务</option>
        {tasks.map((task) => <option key={task.id} value={task.id}>{task.problem}</option>)}
      </select>
      <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="证据名称" className="w-full rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-sm text-gray-100 placeholder-gray-500" />
      <input type="number" value={metricValue} onChange={(event) => setMetricValue(event.target.value)} placeholder="指标值" className="w-full rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-sm text-gray-100 placeholder-gray-500" />
      <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="教师自评：是否达成目标？原因是什么？" className="h-24 w-full resize-none rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-sm text-gray-100 placeholder-gray-500" />
      <button onClick={addEvidence} disabled={!taskId || !label.trim() || !metricValue.trim()} className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:bg-gray-600">
        保存再证据
      </button>
      {bars.length > 0 && (
        <div className="space-y-2 rounded-lg border border-dark-border bg-dark-bg p-3">
          <div className="text-xs text-gray-500">前后对比</div>
          {bars.map((point) => (
            <div key={point.id} className="flex items-center gap-2">
              <span className="w-28 truncate text-xs text-gray-400">{point.label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-dark-card">
                <div className="h-full bg-secondary" style={{ width: `${Math.min(100, point.metricValue)}%` }} />
              </div>
              <span className="w-8 text-right text-xs text-gray-300">{point.metricValue}</span>
            </div>
          ))}
        </div>
      )}
      {status && <p className="rounded-lg border border-dark-border bg-dark-bg p-3 text-xs text-gray-300">{status}</p>}
    </section>
  );
}
