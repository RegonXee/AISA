import { NextRequest, NextResponse } from 'next/server';
import { createCollaborationLog, filterStoreByUser, readStore, summarizeMarkdown, type ArtifactKind } from '@/lib/evidence-store';
import { requireUsername } from '@/lib/user-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const ownerUsername = requireUsername(request);
    const store = filterStoreByUser(await readStore(), ownerUsername);
    return NextResponse.json({ logs: store.collaborationLogs });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '读取协同记录失败' }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ownerUsername = requireUsername(request);
    const body = await request.json();
    const artifactId = String(body.artifactId || '').trim();
    const store = await readStore();
    const artifact = store.artifacts.find(
      (item) => item.id === artifactId && item.ownerUsername === ownerUsername
    );

    if (!artifact) {
      return NextResponse.json({ error: '请先保存当前用户对应的 AI 生成成果' }, { status: 400 });
    }

    const teacherDecision = String(body.teacherDecision || '').trim();
    const reflection = String(body.reflection || '').trim();
    if (!teacherDecision || !reflection) {
      return NextResponse.json({ error: '请填写教师决策和反思' }, { status: 400 });
    }

    const log = await createCollaborationLog({
      ownerUsername,
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
      { status: error instanceof Error && error.message.includes('登录') ? 401 : 500 }
    );
  }
}

