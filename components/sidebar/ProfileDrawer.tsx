'use client';

import { useEffect, useState } from 'react';

interface Profile {
  classroomGuidance: number;
  questionQuality: number;
  studentLanguageOutput: number;
  activityPacing: number;
  feedbackAndCorrection: number;
  improvementContinuity: number;
}

interface OverallEvaluation {
  score: number;
  level: string;
}

interface TrendItem {
  month: string;
  score: number;
}

interface IssueTimelineItem {
  id: string;
  date: string;
  evidenceTitle: string;
  scoreBefore: number;
  scoreAfter?: number;
  improved?: boolean;
  summary: string;
}

const AXES = [
  { key: 'classroomGuidance', label: '主导' },
  { key: 'questionQuality', label: '提问' },
  { key: 'studentLanguageOutput', label: '产出' },
  { key: 'activityPacing', label: '节奏' },
  { key: 'feedbackAndCorrection', label: '反馈' },
  { key: 'improvementContinuity', label: '改进' },
] as const;

function MiniRing({ overall }: { overall: OverallEvaluation }) {
  const radius = 48;
  const circumference = Math.PI * 2 * radius;
  const progress = circumference * (overall.score / 100);

  return (
    <svg viewBox="0 0 120 120" className="mx-auto h-36 w-36">
      <circle cx="60" cy="60" r={radius} fill="none" stroke="#1E293B" strokeWidth="10" />
      <circle
        cx="60"
        cy="60"
        r={radius}
        fill="none"
        stroke="#0EA5E9"
        strokeLinecap="round"
        strokeWidth="10"
        strokeDasharray={`${progress} ${circumference - progress}`}
        transform="rotate(-90 60 60)"
      />
      <text x="60" y="56" textAnchor="middle" className="fill-white text-2xl font-bold">
        {overall.score}
      </text>
      <text x="60" y="75" textAnchor="middle" className="fill-slate-400 text-[10px]">
        整体评分 / 100
      </text>
      <text x="60" y="90" textAnchor="middle" className="fill-sky-300 text-[10px]">
        {overall.level}
      </text>
    </svg>
  );
}

export default function ProfileDrawer({ refreshKey = 0, defaultOpen = false }: { refreshKey?: number; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [overall, setOverall] = useState<OverallEvaluation | null>(null);
  const [trend, setTrend] = useState<TrendItem[]>([]);
  const [timeline, setTimeline] = useState<IssueTimelineItem[]>([]);
  const [status, setStatus] = useState('');
  const [clearing, setClearing] = useState(false);

  async function load() {
    try {
      const response = await fetch('/api/case-materials');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '读取教师画像失败');
      setProfile(data.profile);
      setOverall(data.overall);
      setTrend(data.trend || []);
      setTimeline(data.issueTimeline || []);
      setStatus('');
    } catch (error) {
      setProfile(null);
      setOverall(null);
      setTrend([]);
      setTimeline([]);
      setStatus(error instanceof Error ? error.message : '读取教师画像失败');
    }
  }

  useEffect(() => {
    load();
  }, [refreshKey]);

  async function clearCurrentUserData() {
    const confirmed = window.confirm('确定清除当前用户的全部数据吗？这会删除课例、协同记录、改进任务、奥威亚诊断记录和教师画像时间轴。');
    if (!confirmed) return;
    const secondConfirmed = window.confirm('请再次确认：该操作只清除当前登录用户的数据，但不可恢复。');
    if (!secondConfirmed) return;

    setClearing(true);
    setStatus('');
    try {
      const response = await fetch('/api/case-materials', { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '清除当前用户数据失败');
      await load();
      setStatus(`已清除当前用户数据：奥威亚诊断 ${data.removed?.teacherIssueRecords || 0} 条。`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '清除当前用户数据失败');
    } finally {
      setClearing(false);
    }
  }

  return (
    <section className="rounded-xl border border-dark-border bg-dark-card">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <span className="font-semibold text-white">教师画像</span>
        <span className="text-sm text-gray-400">{open ? '收起' : '展开'}</span>
      </button>
      {open && (!profile || !overall) && (
        <div className="border-t border-dark-border p-4">
          <p className="rounded-lg border border-dark-border bg-dark-bg p-3 text-xs text-gray-400">
            {status || '请先在侧边栏输入用户名登录。'}
          </p>
        </div>
      )}
      {open && profile && overall && (
        <div className="space-y-4 border-t border-dark-border p-4">
          <MiniRing overall={overall} />
          <div className="grid grid-cols-2 gap-2 text-xs">
            {AXES.map((axis) => (
              <div key={axis.key} className="rounded-lg bg-dark-bg p-3">
                <div className="text-gray-500">{axis.label}</div>
                <div className="mt-1 text-lg font-bold text-primary">{profile[axis.key]}</div>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <div className="text-xs text-gray-500">总评趋势</div>
            {trend.length === 0 ? <p className="text-xs text-gray-500">暂无趋势数据</p> : trend.map((item) => (
              <div key={item.month} className="flex items-center gap-2">
                <span className="w-16 text-xs text-gray-400">{item.month}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-dark-bg">
                  <div className="h-full bg-secondary" style={{ width: `${Math.min(100, item.score)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <div className="text-xs text-gray-500">问题与改进时间轴</div>
            {timeline.length === 0 ? <p className="text-xs text-gray-500">暂无奥威亚诊断记录</p> : timeline.slice(0, 4).map((item) => (
              <div key={item.id} className="rounded-lg border border-dark-border bg-dark-bg p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-gray-300">{item.evidenceTitle}</span>
                  <span className="shrink-0 text-xs text-primary">{item.scoreBefore}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-gray-500">{item.summary || '暂无摘要'}</p>
              </div>
            ))}
          </div>
          <button
            onClick={clearCurrentUserData}
            disabled={clearing}
            className="w-full rounded-lg border border-red-500/50 px-3 py-2 text-xs font-semibold text-red-200 hover:border-red-400 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {clearing ? '清除中...' : '清除当前用户数据'}
          </button>
        </div>
      )}
    </section>
  );
}
