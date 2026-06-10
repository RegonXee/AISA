'use client';

import { useEffect, useState } from 'react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const PAGE_KEY = 'sidebar-chat';

export default function ChatWindow({ aiOutput, step }: { aiOutput: string; step: number }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadMemory() {
    const response = await fetch(`/api/page-memory?pageKey=${PAGE_KEY}`);
    if (!response.ok) return;
    const data = await response.json();
    const memory = data.memory;
    if (!memory) return;
    const input = memory.input || {};
    if (Array.isArray(input.messages)) {
      setMessages(input.messages.filter((item: ChatMessage) => item?.role && typeof item.content === 'string').slice(-20));
    }
    setInput(typeof input.input === 'string' ? input.input : '');
  }

  useEffect(() => {
    loadMemory();
    window.addEventListener('aisa-login', loadMemory);
    return () => window.removeEventListener('aisa-login', loadMemory);
  }, []);

  async function saveMemory(nextMessages = messages, nextInput = input) {
    await fetch('/api/page-memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pageKey: PAGE_KEY,
        input: {
          messages: nextMessages.slice(-20),
          input: nextInput,
        },
        output: nextMessages.filter((message) => message.role === 'assistant').at(-1)?.content || '',
      }),
    }).catch(() => undefined);
  }

  async function send() {
    if (!input.trim()) return;
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: input }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    try {
      const response = await fetch('/api/sidebar-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, aiOutput, step }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '侧边栏对话失败');
      const completedMessages: ChatMessage[] = [...nextMessages, { role: 'assistant', content: data.content }];
      setMessages(completedMessages);
      await saveMemory(completedMessages, '');
    } catch (error) {
      const failedMessages: ChatMessage[] = [...nextMessages, { role: 'assistant', content: error instanceof Error ? error.message : '对话失败' }];
      setMessages(failedMessages);
      await saveMemory(failedMessages, '');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-3">
      <h3 className="text-base font-semibold text-white">侧边栏 AI 对话</h3>
      <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-dark-border bg-dark-bg p-3">
        {messages.length === 0 ? (
          <p className="text-sm text-gray-500">可以追问：这条建议为什么适合我的学生？如何改得更符合学情？</p>
        ) : messages.map((message, index) => (
          <div key={index} className={`rounded-lg px-3 py-2 text-sm ${message.role === 'user' ? 'bg-primary/15 text-primary' : 'bg-dark-card text-gray-300'}`}>
            <div className="mb-1 text-xs opacity-70">{message.role === 'user' ? '教师' : 'AI生成'}</div>
            {message.content}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') send(); }} placeholder="输入追问..." className="min-w-0 flex-1 rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-sm text-gray-100 placeholder-gray-500" />
        <button onClick={send} disabled={loading} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:bg-gray-600">
          {loading ? '...' : '发送'}
        </button>
      </div>
    </section>
  );
}
