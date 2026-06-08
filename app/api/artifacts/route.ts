import { NextRequest, NextResponse } from 'next/server';
import { createArtifact, filterStoreByUser, readStore, summarizeMarkdown, type ArtifactKind } from '@/lib/evidence-store';
import { requireUsername } from '@/lib/user-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_KINDS: ArtifactKind[] = ['lesson-design', 'essay-eval', 'exam-review'];

export async function GET(request: NextRequest) {
  try {
    const ownerUsername = requireUsername(request);
    const store = filterStoreByUser(await readStore(), ownerUsername);
    return NextResponse.json({ artifacts: store.artifacts });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '读取成果失败' }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ownerUsername = requireUsername(request);
    const body = await request.json();
    const kind = body.kind as ArtifactKind;
    const title = String(body.title || '').trim();
    const content = String(body.content || '').trim();
    const inputSummary = String(body.inputSummary || '').trim();

    if (!VALID_KINDS.includes(kind)) {
      return NextResponse.json({ error: '无效的成果类型' }, { status: 400 });
    }
    if (!title || !content) {
      return NextResponse.json({ error: '请提供标题和生成内容' }, { status: 400 });
    }

    const artifact = await createArtifact({
      ownerUsername,
      kind,
      title,
      content,
      inputSummary: inputSummary || summarizeMarkdown(content),
    });

    return NextResponse.json({ artifact });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '保存成果失败' },
      { status: error instanceof Error && error.message.includes('登录') ? 401 : 500 }
    );
  }
}

