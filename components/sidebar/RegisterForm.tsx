'use client';

import { useEffect, useState } from 'react';

interface UserProfile {
  name: string;
  school: string;
  subject: string;
  grade: string;
}

const STORAGE_KEY = 'aisa_user_profile';

export default function RegisterForm() {
  const [profile, setProfile] = useState<UserProfile>({ name: '', school: '', subject: '英语', grade: '' });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      setProfile(JSON.parse(raw));
      setSaved(true);
    }
  }, []);

  function save() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    document.cookie = `aisa_user=${encodeURIComponent(profile.name || 'teacher')}; path=/; max-age=31536000`;
    setSaved(true);
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">教师信息</h3>
        {saved && <span className="rounded-full bg-secondary/15 px-2 py-1 text-xs text-secondary">已保存</span>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} placeholder="姓名" className="rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-sm text-gray-100 placeholder-gray-500" />
        <input value={profile.school} onChange={(event) => setProfile({ ...profile, school: event.target.value })} placeholder="学校" className="rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-sm text-gray-100 placeholder-gray-500" />
        <input value={profile.subject} onChange={(event) => setProfile({ ...profile, subject: event.target.value })} placeholder="学科" className="rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-sm text-gray-100 placeholder-gray-500" />
        <input value={profile.grade} onChange={(event) => setProfile({ ...profile, grade: event.target.value })} placeholder="任教年级" className="rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-sm text-gray-100 placeholder-gray-500" />
      </div>
      <button onClick={save} className="w-full rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-sm font-semibold text-gray-200 transition-colors hover:border-primary">
        保存教师信息
      </button>
    </section>
  );
}

