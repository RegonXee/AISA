import { NextRequest, NextResponse } from 'next/server';
import { normalizeUsername, USER_COOKIE } from '@/lib/user-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = normalizeUsername(body.username);

    if (!username) {
      return NextResponse.json({ error: '请输入用户名' }, { status: 400 });
    }

    const response = NextResponse.json({ username });
    response.cookies.set(USER_COOKIE, username, {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '登录失败' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const username = normalizeUsername(request.cookies.get(USER_COOKIE)?.value);
  return NextResponse.json({ username });
}

