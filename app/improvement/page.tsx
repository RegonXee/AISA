'use client';

import { useEffect, useState } from 'react';

interface Artifact {
  id: string;
  kind: string;
  title: string;
}

interface EvidencePoint {
  id: string;
  label: string;
  metricName: string;
  metricValue: number;
  note: string;
  collectedAt: string;
}

interface ImprovementTask {
  id: string;
  sourceArtifactId?: string;
  problem: string;
  actionPlan: string;
  nextEvidenceDate: string;
  targetMetric: string;
  targetValue: number;
  status: string;
  achieved?: boolean;
  evidence: EvidencePoint[];
  createdAt: string;
}

export default function ImprovementPage() {
  const [tasks, setTasks] = useState<ImprovementTask[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [form, setForm] = useState({
    sourceArtifactId: '',
    problem: '',
    actionPlan: '',
    nextEvidenceDate: '',
    targetMetric: '达成率',
    targetValue: '80',
  });
  const [evidenceForm, setEvidenceForm] = useState({
    taskId: '',
    label: '',
    metricName: '达成率',
    metricValue: '',
    note: '',
  });

  async function loadData() {
    const response = await fetch('/api/improvement-tasks');
    const data = await response.json();
    setTasks(data.tasks || []);
    setArtifacts(data.artifacts || []);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function createTask() {
    setStatus(null);
    try {
      const artifact = artifacts.find((item) => item.id === form.sourceArtifactId);
      const response = await fetch('/api/improvement-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          sourceArtifactKind: artifact?.kind,
          targetValue: Number(form.targetValue),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '创建失败');
      setForm({ sourceArtifactId: '', problem: '', actionPlan: '', nextEvidenceDate: '', targetMetric: '达成率', targetValue: '80' });
      setStatus('改进任务已创建。');
      await loadData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '创建失败');
    }
  }

  async function addEvidence() {
    setStatus(null);
    try {
      const response = await fetch('/api/improvement-tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add-evidence',
          taskId: evidenceForm.taskId,
          label: evidenceForm.label,
          metricName: evidenceForm.metricName,
          metricValue: Number(evidenceForm.metricValue),
          note: evidenceForm.note,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '保存证据失败');
      setEvidenceForm({ taskId: '', label: '', metricName: '达成率', metricValue: '', note: '' });
      setStatus('再证据已保存，系统已更新闭环状态。');
      await loadData();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '保存证据失败');
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">改进闭环</h1>
        <p className="text-gray-400">把诊断结果转化为行动任务，并用下一次证据验证改进效果。</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <section className="bg-dark-card border border-dark-border rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-5">创建改进任务</h2>
          <div className="space-y-4">
            <select value={form.sourceArtifactId} onChange={(event) => setForm({ ...form, sourceArtifactId: event.target.value })} className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-gray-100">
              <option value="">关联一个 AI 成果（可选）</option>
              {artifacts.map((artifact) => <option key={artifact.id} value={artifact.id}>{artifact.title}</option>)}
            </select>
            <textarea value={form.problem} onChange={(event) => setForm({ ...form, problem: event.target.value })} placeholder="选择或描述问题，例如：作文细节描写薄弱" className="w-full h-24 bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 resize-none" />
            <textarea value={form.actionPlan} onChange={(event) => setForm({ ...form, actionPlan: event.target.value })} placeholder="计划采取的行动，例如：本周增加一节细节描写微课" className="w-full h-24 bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 resize-none" />
            <div className="grid md:grid-cols-3 gap-3">
              <input type="date" value={form.nextEvidenceDate} onChange={(event) => setForm({ ...form, nextEvidenceDate: event.target.value })} className="bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-gray-100" />
              <input value={form.targetMetric} onChange={(event) => setForm({ ...form, targetMetric: event.target.value })} placeholder="目标指标" className="bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500" />
              <input type="number" value={form.targetValue} onChange={(event) => setForm({ ...form, targetValue: event.target.value })} placeholder="目标值" className="bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500" />
            </div>
            <button onClick={createTask} className="w-full py-3 bg-primary hover:bg-primary/90 text-white font-semibold rounded-lg transition-colors">创建任务</button>
          </div>
        </section>

        <section className="bg-dark-card border border-dark-border rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-5">上传再证据</h2>
          <div className="space-y-4">
            <select value={evidenceForm.taskId} onChange={(event) => setEvidenceForm({ ...evidenceForm, taskId: event.target.value })} className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-gray-100">
              <option value="">选择改进任务</option>
              {tasks.map((task) => <option key={task.id} value={task.id}>{task.problem}</option>)}
            </select>
            <input value={evidenceForm.label} onChange={(event) => setEvidenceForm({ ...evidenceForm, label: event.target.value })} placeholder="证据名称，例如：第二次作文分析" className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500" />
            <div className="grid md:grid-cols-2 gap-3">
              <input value={evidenceForm.metricName} onChange={(event) => setEvidenceForm({ ...evidenceForm, metricName: event.target.value })} placeholder="指标名称" className="bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500" />
              <input type="number" value={evidenceForm.metricValue} onChange={(event) => setEvidenceForm({ ...evidenceForm, metricValue: event.target.value })} placeholder="指标值" className="bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500" />
            </div>
            <textarea value={evidenceForm.note} onChange={(event) => setEvidenceForm({ ...evidenceForm, note: event.target.value })} placeholder="证据说明或教师判断" className="w-full h-24 bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 resize-none" />
            <button onClick={addEvidence} className="w-full py-3 bg-secondary hover:bg-secondary/90 text-white font-semibold rounded-lg transition-colors">保存再证据</button>
          </div>
        </section>
      </div>

      {status && <div className="mb-6 bg-dark-card border border-dark-border rounded-lg p-4 text-gray-300">{status}</div>}

      <section className="space-y-4">
        {tasks.length === 0 ? (
          <div className="bg-dark-card border border-dark-border rounded-xl p-8 text-gray-400">暂无改进任务。</div>
        ) : tasks.map((task) => {
          const maxValue = Math.max(task.targetValue, ...task.evidence.map((point) => point.metricValue), 1);
          return (
            <article key={task.id} className="bg-dark-card border border-dark-border rounded-xl p-6">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <h2 className="text-xl font-bold text-white">{task.problem}</h2>
                <span className="px-3 py-1 bg-primary/15 text-primary rounded-full text-sm">{task.status}</span>
                {task.achieved !== undefined && <span className={`px-3 py-1 rounded-full text-sm ${task.achieved ? 'bg-secondary/15 text-secondary' : 'bg-red-500/15 text-red-300'}`}>{task.achieved ? '已达成' : '未达成'}</span>}
              </div>
              <p className="text-gray-300 mb-2">行动：{task.actionPlan}</p>
              <p className="text-gray-500 text-sm mb-5">下次采集证据时间：{task.nextEvidenceDate}；目标：{task.targetMetric} ≥ {task.targetValue}</p>
              <div className="grid md:grid-cols-4 gap-3 mb-5">
                {['问题', '行动', '再证据', '结果'].map((step, index) => (
                  <div key={step} className="bg-dark-bg border border-dark-border rounded-lg p-4">
                    <div className="text-primary font-bold mb-2">{index + 1}</div>
                    <div className="text-white">{step}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-24 text-sm text-gray-400">目标</div>
                  <div className="flex-1 bg-dark-bg rounded-full h-3 overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${Math.min(100, (task.targetValue / maxValue) * 100)}%` }} />
                  </div>
                  <div className="w-16 text-right text-sm text-gray-300">{task.targetValue}</div>
                </div>
                {task.evidence.map((point) => (
                  <div key={point.id} className="flex items-center gap-3">
                    <div className="w-24 text-sm text-gray-400 truncate">{point.label}</div>
                    <div className="flex-1 bg-dark-bg rounded-full h-3 overflow-hidden">
                      <div className="h-full bg-secondary" style={{ width: `${Math.min(100, (point.metricValue / maxValue) * 100)}%` }} />
                    </div>
                    <div className="w-16 text-right text-sm text-gray-300">{point.metricValue}</div>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

