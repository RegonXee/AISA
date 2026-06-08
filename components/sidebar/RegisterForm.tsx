'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'aisa_username';

export default function RegisterForm() {
  const [username, setUsername] = useState('');
  const [activeUsername, setActiveUsername] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadCurrentUser() {
      const cached = window.localStorage.getItem(STORAGE_KEY) || '';
      if (cached) {
        setUsername(cached);
        setActiveUsername(cached);
      }

      try {
        const response = await fetch('/api/auth/login');
        const data = await response.json();
        if (data.username) {
          setUsername(data.username);
          setActiveUsername(data.username);
          window.localStorage.setItem(STORAGE_KEY, data.username);
        }
      } catch {
        setStatus('暂时无法读取登录状态，请稍后重试。');
      }
    }
    loadCurrentUser();
  }, []);

  async function login() {
    if (!username.trim()) {
      setStatus('请输入用户名。');
      return;
    }

    setSaving(true);
    setStatus('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '登录失败');
      setUsername(data.username);
      setActiveUsername(data.username);
      window.localStorage.setItem(STORAGE_KEY, data.username);
      window.dispatchEvent(new Event('aisa-login'));
      setStatus('已登录，系统会只显示该用户名下的数据。');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '登录失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">教师登录</h3>
        {activeUsername && <span className="rounded-full bg-secondary/15 px-2 py-1 text-xs text-secondary">已登录</span>}
      </div>
      <p className="text-xs text-gray-500">
        只需要用户名，不需要密码。不同用户名的数据会分别保存和读取。
      </p>
      <input
        value={username}
        onChange={(event) => setUsername(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') login();
        }}
        placeholder="输入教师用户名"
        className="w-full rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-sm text-gray-100 placeholder-gray-500"
      />
      {activeUsername && (
        <p className="rounded-lg border border-dark-border bg-dark-bg p-3 text-xs text-gray-300">
          当前用户：<span className="font-semibold text-primary">{activeUsername}</span>
        </p>
      )}
      <button
        onClick={login}
        disabled={saving || !username.trim()}
        className="w-full rounded-lg border border-primary/40 bg-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:border-dark-border disabled:bg-gray-600"
      >
        {saving ? '登录中...' : activeUsername && activeUsername !== username ? '切换用户' : '登录 / 保存用户名'}
      </button>
      {status && <p className="rounded-lg border border-dark-border bg-dark-bg p-3 text-xs text-gray-300">{status}</p>}
    </section>
  );
}
