import { NextRequest } from 'next/server';

export const USER_COOKIE = 'aisa_username';

export function normalizeUsername(value: unknown) {
  return String(value || '')
    .trim()
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9_\-.@]/g, '')
    .slice(0, 40);
}

export function getUsernameFromRequest(request: NextRequest) {
  return normalizeUsername(request.cookies.get(USER_COOKIE)?.value);
}

export function requireUsername(request: NextRequest) {
  const username = getUsernameFromRequest(request);
  if (!username) {
    throw new Error('请先输入用户名登录 AISA');
  }
  return username;
}

