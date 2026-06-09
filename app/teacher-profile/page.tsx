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

interface OverallDimension {
  key: string;
  label: string;
  score: number;
  description: string;
}

interface OverallEvaluation {
  score: number;
  level: string;
  dimensions: OverallDimension[];
}

interface TrendItem {
  month: string;
  score: number;
  logs: number;
  completedTasks: number;
  evidence: number;
  issueRecords?: number;
  verified?: number;
  profile?: Profile;
}

interface IssueTimelineItem {
  id: string;
  date: string;
  teacherName: string;
  evidenceTitle: string;
  scoreBefore: number;
  scoreAfter?: number;
  improved?: boolean;
  summary: string;
  nextAction: string;
}

const PROFILE_AXES = [
  { key: 'classroomGuidance', label: '课堂主导方式', color: '#38BDF8' },
  { key: 'questionQuality', label: '问题设计质量', color: '#A78BFA' },
  { key: 'studentLanguageOutput', label: '学生语言产出', color: '#34D399' },
  { key: 'activityPacing', label: '活动组织与节奏', color: '#F59E0B' },
  { key: 'feedbackAndCorrection', label: '反馈与纠错能力', color: '#F472B6' },
  { key: 'improvementContinuity', label: '持续改进趋势', color: '#22C55E' },
] as const;

function OverallRing({ overall }: { overall: OverallEvaluation }) {
  const radius = 72;
  const circumference = Math.PI * 2 * radius;
  const progress = circumference * (overall.score / 100);

  return (
    <div className="flex flex-col items-center justify-center">
      <svg viewBox="0 0 180 180" className="h-52 w-52">
        <circle cx="90" cy="90" r={radius} fill="none" stroke="#1E293B" strokeWidth="16" />
        <circle
          cx="90"
          cy="90"
          r={radius}
          fill="none"
          stroke="#0EA5E9"
          strokeLinecap="round"
          strokeWidth="16"
          strokeDasharray={`${progress} ${circumference - progress}`}
          transform="rotate(-90 90 90)"
        />
        <text x="90" y="82" textAnchor="middle" className="fill-white text-4xl font-bold">
          {overall.score}
        </text>
        <text x="90" y="108" textAnchor="middle" className="fill-slate-400 text-xs">
          整体评分 / 100
        </text>
        <text x="90" y="126" textAnchor="middle" className="fill-sky-300 text-xs">
          {overall.level}
        </text>
      </svg>
    </div>
  );
}

function DimensionTrendChart({ trend }: { trend: TrendItem[] }) {
  const width = 920;
  const height = 320;
  const padding = { top: 24, right: 28, bottom: 44, left: 44 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const usableTrend = trend.filter((item) => item.profile);
  const xFor = (index: number) => padding.left + (usableTrend.length <= 1 ? plotWidth / 2 : (plotWidth * index) / (usableTrend.length - 1));
  const yFor = (score: number) => padding.top + plotHeight - (Math.max(0, Math.min(100, score)) / 100) * plotHeight;

  if (usableTrend.length === 0) {
    return <p className="text-gray-400">暂无月度数据。生成奥威亚诊断后会自动形成多维折线趋势。</p>;
  }

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[760px]">
        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={tick}>
            <line x1={padding.left} x2={width - padding.right} y1={yFor(tick)} y2={yFor(tick)} stroke="#1E293B" />
            <text x="12" y={yFor(tick) + 4} className="fill-slate-500 text-xs">{tick}</text>
          </g>
        ))}
        {PROFILE_AXES.map((axis) => {
          const points = usableTrend.map((item, index) => `${xFor(index)},${yFor(item.profile?.[axis.key] || 0)}`).join(' ');
          return (
            <g key={axis.key}>
              <polyline points={points} fill="none" stroke={axis.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {usableTrend.map((item, index) => (
                <circle key={`${axis.key}-${item.month}`} cx={xFor(index)} cy={yFor(item.profile?.[axis.key] || 0)} r="4" fill={axis.color} />
              ))}
            </g>
          );
        })}
        {usableTrend.map((item, index) => (
          <text key={item.month} x={xFor(index)} y={height - 14} textAnchor="middle" className="fill-slate-400 text-xs">
            {item.month}
          </text>
        ))}
      </svg>
    </div>
  );
}

export default function TeacherProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [overall, setOverall] = useState<OverallEvaluation | null>(null);
  const [trend, setTrend] = useState<TrendItem[]>([]);
  const [issueTimeline, setIssueTimeline] = useState<IssueTimelineItem[]>([]);
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
      setIssueTimeline(data.issueTimeline || []);
      setStatus('');
    } catch (error) {
      setProfile(null);
      setOverall(null);
      setTrend([]);
      setIssueTimeline([]);
      setStatus(error instanceof Error ? error.message : '读取教师画像失败');
    }
  }

  useEffect(() => {
    load();
  }, []);

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
      setStatus(`已清除当前用户数据：课例 ${data.removed?.artifacts || 0} 条，协同记录 ${data.removed?.collaborationLogs || 0} 条，改进任务 ${data.removed?.improvementTasks || 0} 条，奥威亚诊断 ${data.removed?.teacherIssueRecords || 0} 条。`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '清除当前用户数据失败');
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-white">教师发展画像</h1>
          <p className="text-gray-400">基于奥威亚诊断、教师反思和改进闭环，追踪教师课堂行为与专业成长。</p>
        </div>
        <button
          onClick={clearCurrentUserData}
          disabled={clearing}
          className="rounded-lg border border-red-500/50 px-4 py-2 text-sm font-semibold text-red-200 transition-colors hover:border-red-400 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {clearing ? '清除中...' : '清除当前用户数据'}
        </button>
      </div>

      {status && <p className="mb-6 rounded-lg border border-dark-border bg-dark-card p-3 text-sm text-gray-300">{status}</p>}

      {!profile || !overall ? (
        <div className="text-gray-400">正在生成画像...</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <section className="rounded-xl border border-dark-border bg-dark-card p-6">
            <h2 className="mb-5 text-xl font-bold text-white">总评</h2>
            <OverallRing overall={overall} />
          </section>

          <section className="rounded-xl border border-dark-border bg-dark-card p-6">
            <h2 className="mb-5 text-xl font-bold text-white">总评维度</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {overall.dimensions.map((dimension) => (
                <div key={dimension.key} className="rounded-lg border border-dark-border bg-dark-bg p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-gray-200">{dimension.label}</span>
                    <span className="text-lg font-bold text-primary">{dimension.score}</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-gray-500">{dimension.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-dark-border bg-dark-card p-6 lg:col-span-2">
            <h2 className="mb-5 text-xl font-bold text-white">多维成长折线</h2>
            <DimensionTrendChart trend={trend} />
            <div className="mt-4 flex flex-wrap gap-3">
              {PROFILE_AXES.map((axis) => (
                <div key={axis.key} className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: axis.color }} />
                  {axis.label}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-dark-border bg-dark-card p-6 lg:col-span-2">
            <h2 className="mb-5 text-xl font-bold text-white">当前维度分布</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {PROFILE_AXES.map((axis) => (
                <div key={axis.key} className="rounded-lg border border-dark-border bg-dark-bg p-4">
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="text-gray-300">{axis.label}</span>
                    <span className="font-semibold text-primary">{profile[axis.key]}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full" style={{ width: `${profile[axis.key]}%`, backgroundColor: axis.color }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-dark-border bg-dark-card p-6 lg:col-span-2">
            <h2 className="mb-5 text-xl font-bold text-white">问题与改进时间轴</h2>
            {issueTimeline.length === 0 ? (
              <p className="text-gray-400">暂无奥威亚诊断记录。上传奥威亚数据和逐字稿后，会在这里形成每位教师的问题与改进轨迹。</p>
            ) : (
              <div className="space-y-4">
                {issueTimeline.map((item) => (
                  <article key={item.id} className="grid gap-4 rounded-lg border border-dark-border bg-dark-bg p-4 md:grid-cols-[160px_1fr_140px]">
                    <div>
                      <div className="text-sm text-gray-500">{new Date(item.date).toLocaleString('zh-CN')}</div>
                      <div className="mt-2 font-semibold text-white">{item.teacherName}</div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{item.evidenceTitle}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-gray-400">{item.summary || '暂无问题摘要'}</p>
                      <p className="mt-2 text-xs leading-relaxed text-gray-500">下一步：{item.nextAction}</p>
                    </div>
                    <div className="rounded-lg border border-dark-border bg-dark-card p-3 text-center">
                      <div className="text-xs text-gray-500">诊断评分</div>
                      <div className="mt-1 text-2xl font-bold text-primary">{item.scoreBefore}</div>
                      {item.scoreAfter !== undefined && (
                        <div className={item.improved ? 'mt-1 text-xs text-secondary' : 'mt-1 text-xs text-red-300'}>
                          {item.improved ? '已改进' : '待继续'}
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
