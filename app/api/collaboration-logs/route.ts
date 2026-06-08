import { NextRequest, NextResponse } from 'next/server';
import { createCollaborationLog, readStore, summarizeMarkdown, type ArtifactKind } from '@/lib/evidence-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const store = await readStore();
  return NextResponse.json({ logs: store.collaborationLogs });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const artifactId = String(body.artifactId || '').trim();
    const store = await readStore();
    const artifact = store.artifacts.find((item) => item.id === artifactId);

    if (!artifact) {
      return NextResponse.json({ error: '请先保存对应的 AI 生成成果' }, { status: 400 });
    }

    const teacherDecision = String(body.teacherDecision || '').trim();
    const reflection = String(body.reflection || '').trim();
    if (!teacherDecision || !reflection) {
      return NextResponse.json({ error: '请填写教师决策和反思' }, { status: 400 });
    }

    const log = await createCollaborationLog({
      artifactId: artifact.id,
      artifactKind: artifact.kind as ArtifactKind,
      artifactTitle: artifact.title,
      aiSuggestionSummary: summarizeMarkdown(artifact.content),
      teacherDecision,
      adoptedParts: String(body.adoptedParts || '').trim(),
      modifiedParts: String(body.modifiedParts || '').trim(),
      reflection,
    });

    return NextResponse.json({ log });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '保存协同记录失败' },
      { status: 500 }
    );
  }
}

