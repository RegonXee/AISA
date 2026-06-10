import { NextRequest, NextResponse } from 'next/server';
import { getPageMemory, upsertPageMemory, type PageMemory } from '@/lib/evidence-store';
import { requireUsername } from '@/lib/user-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_PAGE_KEYS: PageMemory['pageKey'][] = ['lesson-design', 'essay-eval', 'exam-review', 'sidebar-chat', 'teacher-issues'];

function parsePageKey(value: unknown): PageMemory['pageKey'] | null {
  const pageKey = String(value || '') as PageMemory['pageKey'];
  return VALID_PAGE_KEYS.includes(pageKey) ? pageKey : null;
}

export async function GET(request: NextRequest) {
  try {
    const ownerUsername = requireUsername(request);
    const pageKey = parsePageKey(request.nextUrl.searchParams.get('pageKey'));
    if (!pageKey) return NextResponse.json({ error: '无效的页面记忆类型' }, { status: 400 });

    const memory = await getPageMemory(ownerUsername, pageKey);
    return NextResponse.json({ memory });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '读取页面记忆失败' },
      { status: error instanceof Error && error.message.includes('登录') ? 401 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ownerUsername = requireUsername(request);
    const body = await request.json();
    const pageKey = parsePageKey(body.pageKey);
    if (!pageKey) return NextResponse.json({ error: '无效的页面记忆类型' }, { status: 400 });

    const memory = await upsertPageMemory({
      ownerUsername,
      pageKey,
      input: typeof body.input === 'object' && body.input !== null ? body.input : {},
      output: String(body.output || ''),
    });
    return NextResponse.json({ memory });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '保存页面记忆失败' },
      { status: error instanceof Error && error.message.includes('登录') ? 401 : 500 }
    );
  }
}
