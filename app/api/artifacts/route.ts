import { NextRequest, NextResponse } from 'next/server';
import { createArtifact, readStore, summarizeMarkdown, type ArtifactKind } from '@/lib/evidence-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_KINDS: ArtifactKind[] = ['lesson-design', 'essay-eval', 'exam-review'];

export async function GET() {
  const store = await readStore();
  return NextResponse.json({ artifacts: store.artifacts });
}

export async function POST(request: NextRequest) {
  try {
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
      kind,
      title,
      content,
      inputSummary: inputSummary || summarizeMarkdown(content),
    });

    return NextResponse.json({ artifact });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '保存成果失败' },
      { status: 500 }
    );
  }
}

