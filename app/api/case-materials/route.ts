import { NextResponse } from 'next/server';
import { buildCaseReport, buildMonthlyTrend, calculateTeacherProfile } from '@/lib/analytics';
import { readStore } from '@/lib/evidence-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const store = await readStore();
  const profile = calculateTeacherProfile(store);
  const trend = buildMonthlyTrend(store);
  const report = buildCaseReport(store);

  const infoTable = {
    caseName: '人机协同循证教研支持下的初中英语教学改进案例',
    author: '待填写',
    scenario: '初中英语教学设计、作文评价、试卷讲评与教学改进闭环',
    evidenceCount: store.artifacts.length,
    reflectionCount: store.collaborationLogs.length,
    improvementTaskCount: store.improvementTasks.length,
  };

  const videoScript = `1-2分钟概述：介绍案例背景、AI 工具介入的三个场景，以及“教师保留决策权”的人机协同原则。

5-6分钟过程：展示一次 AI 生成成果、教师决策反思日志、改进任务创建、再证据上传和前后对比图。

1-2分钟成效：展示教师画像雷达图、成长趋势、闭环任务达成情况，并说明 AI 生成内容已由教师审核标注。`;

  return NextResponse.json({ profile, trend, report, infoTable, videoScript });
}

