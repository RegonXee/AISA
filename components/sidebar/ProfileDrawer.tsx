'use client';

import { useEffect, useState } from 'react';

interface Profile {
  instructionalDesign: number;
  dataAnalysis: number;
  reflectionDepth: number;
  improvementExecution: number;
}

interface TrendItem {
  month: string;
  score: number;
  issueRecords?: number;
  verified?: number;
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
  { key: 'instructionalDesign', label: '设计' },
  { key: 'dataAnalysis', label: '数据' },
  { key: 'reflectionDepth', label: '反思' },
  { key: 'improvementExecution', label: '执行' },
] as const;

function MiniRadar({ profile }: { profile: Profile }) {
  const center = 90;
  const radius = 62;
  const points = AXES.map((axis, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / AXES.length;
    const value = profile[axis.key] / 100;
    return {
      ...axis,
      x: center + Math.cos(angle) * radius * value,
      y: center + Math.sin(angle) * radius * value,
      ax: center + Math.cos(angle) * radius,
      ay: center + Math.sin(angle) * radius,
      lx: center + Math.cos(angle) * (radius + 16),
      ly: center + Math.sin(angle) * (radius + 16),
    };
  });

  return (
    <svg viewBox="0 0 180 180" className="mx-auto w-56 max-w-full">
      {[0.33, 0.66, 1].map((scale) => (
        <polygon key={scale} points={AXES.map((_, index) => {
          const angle = -Math.PI / 2 + (Math.PI * 2 * index) / AXES.length;
          return `${center + Math.cos(angle) * radius * scale},${center + Math.sin(angle) * radius * scale}`;
        }).join(' ')} fill="none" stroke="#334155" />
      ))}
      {points.map((point) => <line key={point.key} x1={center} y1={center} x2={point.ax} y2={point.ay} stroke="#334155" />)}
      <polygon points={points.map((point) => `${point.x},${point.y}`).join(' ')} fill="rgba(14,165,233,.25)" stroke="#0EA5E9" strokeWidth="2" />
      {points.map((point) => <text key={point.key} x={point.lx} y={point.ly} fill="#CBD5E1" fontSize="10" textAnchor="middle" dominantBaseline="middle">{point.label}</text>)}
    </svg>
  );
}

export default function ProfileDrawer({ refreshKey = 0, defaultOpen = false }: { refreshKey?: number; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [trend, setTrend] = useState<TrendItem[]>([]);
  const [timeline, setTimeline] = useState<IssueTimelineItem[]>([]);
  const [status, setStatus] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch('/api/case-materials');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '读取教师画像失败');
        setProfile(data.profile);
        setTrend(data.trend || []);
        setTimeline(data.issueTimeline || []);
        setStatus('');
      } catch (error) {
        setProfile(null);
        setTrend([]);
        setTimeline([]);
        setStatus(error instanceof Error ? error.message : '读取教师画像失败');
      }
    }
    load();
  }, [refreshKey]);

  return (
    <section className="rounded-xl border border-dark-border bg-dark-card">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <span className="font-semibold text-white">教师画像</span>
        <span className="text-sm text-gray-400">{open ? '收起' : '展开'}</span>
      </button>
      {open && !profile && (
        <div className="border-t border-dark-border p-4">
          <p className="rounded-lg border border-dark-border bg-dark-bg p-3 text-xs text-gray-400">
            {status || '请先在侧边栏输入用户名登录。'}
          </p>
        </div>
      )}
      {open && profile && (
        <div className="space-y-4 border-t border-dark-border p-4">
          <MiniRadar profile={profile} />
          <div className="grid grid-cols-2 gap-2 text-xs">
            {AXES.map((axis) => (
              <div key={axis.key} className="rounded-lg bg-dark-bg p-3">
                <div className="text-gray-500">{axis.label}</div>
                <div className="mt-1 text-lg font-bold text-primary">{profile[axis.key]}</div>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <div className="text-xs text-gray-500">成长趋势</div>
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
        </div>
      )}
    </section>
  );
}
