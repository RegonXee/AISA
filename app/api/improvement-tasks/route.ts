import { NextRequest, NextResponse } from 'next/server';
import { addEvidencePoint, createImprovementTask, readStore, updateTaskStatus, type ArtifactKind, type TaskStatus } from '@/lib/evidence-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const store = await readStore();
  return NextResponse.json({ tasks: store.improvementTasks, artifacts: store.artifacts });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const problem = String(body.problem || '').trim();
    const actionPlan = String(body.actionPlan || '').trim();
    const nextEvidenceDate = String(body.nextEvidenceDate || '').trim();
    const targetMetric = String(body.targetMetric || '').trim();
    const targetValue = Number(body.targetValue);

    if (!problem || !actionPlan || !nextEvidenceDate || !targetMetric || Number.isNaN(targetValue)) {
      return NextResponse.json({ error: '请完整填写问题、行动、再证据时间和目标指标' }, { status: 400 });
    }

    const task = await createImprovementTask({
      sourceArtifactId: body.sourceArtifactId ? String(body.sourceArtifactId) : undefined,
      sourceArtifactKind: body.sourceArtifactKind as ArtifactKind | undefined,
      problem,
      actionPlan,
      nextEvidenceDate,
      targetMetric,
      targetValue,
    });

    return NextResponse.json({ task });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建改进任务失败' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const taskId = String(body.taskId || '').trim();
    const action = String(body.action || '').trim();

    if (!taskId) {
      return NextResponse.json({ error: '缺少任务 ID' }, { status: 400 });
    }

    if (action === 'add-evidence') {
      const metricValue = Number(body.metricValue);
      if (!body.label || !body.metricName || Number.isNaN(metricValue)) {
        return NextResponse.json({ error: '请完整填写证据名称、指标和数值' }, { status: 400 });
      }

      const task = await addEvidencePoint(taskId, {
        label: String(body.label),
        metricName: String(body.metricName),
        metricValue,
        note: String(body.note || ''),
      });
      return NextResponse.json({ task });
    }

    if (action === 'update-status') {
      const status = body.status as TaskStatus;
      if (!['planned', 'in-progress', 'completed'].includes(status)) {
        return NextResponse.json({ error: '无效的任务状态' }, { status: 400 });
      }
      const task = await updateTaskStatus(taskId, status, Boolean(body.achieved));
      return NextResponse.json({ task });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新改进任务失败' },
      { status: 500 }
    );
  }
}

