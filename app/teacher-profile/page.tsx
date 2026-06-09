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
  logs: number;
  completedTasks: number;
  evidence: number;
  issueRecords?: number;
  verified?: number;
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

const AXES = [
  { key: 'instructionalDesign', label: '教学设计能力' },
  { key: 'dataAnalysis', label: '数据分析能力' },
  { key: 'reflectionDepth', label: '反思深度' },
  { key: 'improvementExecution', label: '改进执行力' },
] as const;

function RadarChart({ profile }: { profile: Profile }) {
  const center = 120;
  const radius = 86;
  const points = AXES.map((axis, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / AXES.length;
    const value = profile[axis.key] / 100;
    return {
      axis,
      x: center + Math.cos(angle) * radius * value,
      y: center + Math.sin(angle) * radius * value,
      labelX: center + Math.cos(angle) * (radius + 24),
      labelY: center + Math.sin(angle) * (radius + 24),
      axisX: center + Math.cos(angle) * radius,
      axisY: center + Math.sin(angle) * radius,
    };
  });

  return (
    <svg viewBox="0 0 240 240" className="w-full max-w-sm mx-auto">
      {[0.25, 0.5, 0.75, 1].map((scale) => (
        <polygon
          key={scale}
          points={AXES.map((_, index) => {
            const angle = -Math.PI / 2 + (Math.PI * 2 * index) / AXES.length;
            return `${center + Math.cos(angle) * radius * scale},${center + Math.sin(angle) * radius * scale}`;
          }).join(' ')}
          fill="none"
          stroke="#334155"
          strokeWidth="1"
        />
      ))}
      {points.map((point) => (
        <line key={point.axis.key} x1={center} y1={center} x2={point.axisX} y2={point.axisY} stroke="#334155" strokeWidth="1" />
      ))}
      <polygon points={points.map((point) => `${point.x},${point.y}`).join(' ')} fill="rgba(14,165,233,0.28)" stroke="#0EA5E9" strokeWidth="2" />
      {points.map((point) => (
        <g key={point.axis.key}>
          <circle cx={point.x} cy={point.y} r="4" fill="#10B981" />
          <text x={point.labelX} y={point.labelY} fill="#CBD5E1" fontSize="10" textAnchor="middle" dominantBaseline="middle">
            {point.axis.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function TeacherProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [trend, setTrend] = useState<TrendItem[]>([]);
  const [issueTimeline, setIssueTimeline] = useState<IssueTimelineItem[]>([]);

  useEffect(() => {
    async function load() {
      const response = await fetch('/api/case-materials');
      const data = await response.json();
      setProfile(data.profile);
      setTrend(data.trend || []);
      setIssueTimeline(data.issueTimeline || []);
    }
    load();
  }, []);

  const maxTrend = Math.max(...trend.map((item) => item.score), 100);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">教师发展画像</h1>
        <p className="text-gray-400">基于协同记录、反思日志和改进闭环自动生成教师专业成长指标。</p>
      </div>

      {!profile ? (
        <div className="text-gray-400">正在生成画像...</div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <section className="bg-dark-card border border-dark-border rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-5">能力雷达图</h2>
            <RadarChart profile={profile} />
          </section>

          <section className="bg-dark-card border border-dark-border rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-5">指标解释</h2>
            <div className="space-y-4">
              {AXES.map((axis) => (
                <div key={axis.key}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-300">{axis.label}</span>
                    <span className="text-primary font-semibold">{profile[axis.key]}</span>
                  </div>
                  <div className="h-3 bg-dark-bg rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${profile[axis.key]}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="lg:col-span-2 bg-dark-card border border-dark-border rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-5">成长曲线</h2>
            {trend.length === 0 ? (
              <p className="text-gray-400">暂无月度数据。填写协同记录和闭环任务后会自动生成趋势。</p>
            ) : (
              <div className="space-y-4">
                {trend.map((item) => (
                  <div key={item.month} className="grid md:grid-cols-[120px_1fr_220px] gap-4 items-center">
                    <div className="text-gray-300">{item.month}</div>
                    <div className="h-4 bg-dark-bg rounded-full overflow-hidden">
                      <div className="h-full bg-secondary" style={{ width: `${(item.score / maxTrend) * 100}%` }} />
                    </div>
                    <div className="text-sm text-gray-500">
                      记录{item.logs} · 诊断{item.issueRecords || 0} · 再评{item.verified || 0} · 证据{item.evidence}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="lg:col-span-2 bg-dark-card border border-dark-border rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-5">问题与改进时间轴</h2>
            {issueTimeline.length === 0 ? (
              <p className="text-gray-400">暂无奥威亚诊断记录。上传奥威亚数据和逐字稿后，会在这里形成每位教师的问题与改进轨迹。</p>
            ) : (
              <div className="space-y-4">
                {issueTimeline.map((item) => (
                  <article key={item.id} className="grid gap-4 rounded-lg border border-dark-border bg-dark-bg p-4 md:grid-cols-[160px_1fr_140px]">
                    <div>
                      <div className="text-sm text-gray-500">{new Date(item.date).toLocaleString('zh-CN')}</div>
                      <div className="mt-2 text-white font-semibold">{item.teacherName}</div>
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
