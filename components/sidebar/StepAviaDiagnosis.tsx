'use client';

import { useEffect, useRef, useState } from 'react';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import type { SidebarArtifact } from './SidebarPanel';

interface Props {
  aiOutput: string;
  artifact: SidebarArtifact | null;
  onSaved?: () => void;
}

interface PageMemoryResponse {
  memory?: {
    input?: Record<string, unknown>;
    output?: string;
  } | null;
}

interface JobResponse {
  job?: {
    id: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    stage?: string;
    error?: string;
    resultMarkdown?: string;
    evidenceMarkdown?: string;
  };
}

export default function StepAviaDiagnosis({ aiOutput, artifact, onSaved }: Props) {
  const aviaInputRef = useRef<HTMLInputElement>(null);
  const aviaImageInputRef = useRef<HTMLInputElement>(null);
  const transcriptInputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<number | null>(null);

  const [teacherName, setTeacherName] = useState('');
  const [evidenceTitle, setEvidenceTitle] = useState('');
  const [aviaFile, setAviaFile] = useState<File | null>(null);
  const [aviaImages, setAviaImages] = useState<File[]>([]);
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [aviaDataText, setAviaDataText] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const [result, setResult] = useState('');
  const [evidenceResult, setEvidenceResult] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  function readPageText(selector: string) {
    const node = document.querySelector(selector);
    if (node instanceof HTMLTextAreaElement || node instanceof HTMLInputElement) return node.value;
    return node?.textContent?.trim() || '';
  }

  async function readJsonResponse(response: Response) {
    const rawText = await response.text();
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        return JSON.parse(rawText);
      } catch {
        throw new Error(`接口返回了无效 JSON（HTTP ${response.status}）：${rawText.slice(0, 300)}`);
      }
    }

    const plainText = rawText
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const preview = plainText.slice(0, 500) || rawText.slice(0, 300);
    const likelyReason = response.status === 413
      ? '上传文件过大，常见原因是 Nginx 的 client_max_body_size 过小。'
      : response.status === 502 || response.status === 504
        ? '服务端处理奥威亚 PDF/OCR 时间过长，反向代理或 Node 服务可能超时。'
        : response.status >= 500
          ? '服务端返回了 HTML 错误页，请查看服务器终端或 PM2 日志。'
          : '请求没有命中预期的 JSON 接口，可能是登录、代理或路由配置问题。';
    throw new Error(`接口没有返回 JSON（HTTP ${response.status}）。${likelyReason}\n\n返回内容预览：${preview}`);
  }

  async function loadMemory() {
    try {
      const response = await fetch('/api/page-memory?pageKey=teacher-issues');
      const data: PageMemoryResponse = await response.json();
      const memory = data.memory;
      if (!memory) return;
      const input = memory.input || {};
      const setControlledInput = (selector: string, value: string) => {
        const node = document.querySelector(selector);
        if (!(node instanceof HTMLTextAreaElement || node instanceof HTMLInputElement)) return;
        const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(node), 'value');
        descriptor?.set?.call(node, value);
        node.dispatchEvent(new Event('input', { bubbles: true }));
      };
      if (typeof input.teacherName === 'string') setTeacherName(input.teacherName);
      if (typeof input.evidenceTitle === 'string') setEvidenceTitle(input.evidenceTitle);
      if (typeof input.lessonText === 'string') setControlledInput('[data-lesson-input="true"]', input.lessonText);
      if (typeof input.teacherDemands === 'string') setControlledInput('[data-demand-input="true"]', input.teacherDemands);
      if (typeof input.aviaDataText === 'string') setAviaDataText(input.aviaDataText);
      if (typeof input.transcriptText === 'string') setTranscriptText(input.transcriptText);
      if (typeof input.evidenceMarkdown === 'string') setEvidenceResult(input.evidenceMarkdown);
      if (typeof memory.output === 'string') setResult(memory.output);
      if (typeof memory.output === 'string' && memory.output.trim()) {
        setStatus('已恢复上一次的后台诊断结果。');
      }
    } catch {
      // 忽略恢复失败
    }
  }

  useEffect(() => {
    void loadMemory();
    return () => {
      if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
    };
  }, []);

  async function waitForJob(nextJobId: string) {
    if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);

    const poll = async () => {
      try {
        const response = await fetch(`/api/teacher-issues?jobId=${encodeURIComponent(nextJobId)}`);
        const data: JobResponse = await readJsonResponse(response);
        const currentJob = data.job;
        if (!response.ok || !currentJob) {
          setStatus('后台任务查询失败，请稍后刷新页面查看。');
          setLoading(false);
          if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
          return;
        }

        if (currentJob.status === 'completed') {
          setResult(currentJob.resultMarkdown || '');
          setEvidenceResult(currentJob.evidenceMarkdown || '');
          setStatus('后台识别已完成，结果已写入记忆。');
          setLoading(false);
          if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
          onSaved?.();
          return;
        }

        if (currentJob.status === 'failed') {
          setStatus(currentJob.error || '后台识别失败。');
          setLoading(false);
          if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
        } else {
          setStatus(`后台识别中：${currentJob.stage || '处理中'}。关闭浏览器也会继续执行。`);
        }
      } catch (error) {
        setStatus(error instanceof Error ? error.message : '后台任务查询失败');
        setLoading(false);
        if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
      }
    };

    await poll();
    pollTimerRef.current = window.setInterval(() => {
      void poll();
    }, 3000);
  }

  async function generate() {
    setLoading(true);
    setStatus('正在提交后台识别任务...');
    setResult('');
    setEvidenceResult('');
    try {
      const formData = new FormData();
      formData.append('teacherName', teacherName);
      formData.append('evidenceTitle', evidenceTitle || artifact?.title || '奥威亚课堂数据诊断');
      formData.append('lessonText', readPageText('[data-lesson-input="true"]'));
      formData.append('teacherDemands', readPageText('[data-demand-input="true"]'));
      formData.append('aviaDataText', aviaDataText);
      formData.append('transcriptText', transcriptText);
      if (aviaFile) formData.append('aviaFile', aviaFile);
      aviaImages.forEach((image) => formData.append('aviaImages', image));
      if (transcriptFile) formData.append('transcriptFile', transcriptFile);
      if (artifact) {
        formData.append('sourceArtifactId', artifact.id);
        formData.append('sourceArtifactTitle', artifact.title);
      }

      const response = await fetch('/api/teacher-issues', { method: 'POST', body: formData });
      const data = await readJsonResponse(response);
      if (!response.ok) throw new Error(data.error || '提交教师诊断任务失败');
      const nextJobId = data.job?.id || '';
      setStatus(data.message || '后台任务已提交，完成后会自动写入记忆。');
      if (nextJobId) {
        void waitForJob(nextJobId);
      }
      onSaved?.();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '生成教师问题诊断失败');
      setLoading(false);
    }
  }

  async function downloadDoc() {
    if (!result) return;
    const response = await fetch('/api/export-doc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown: result }),
    });
    if (!response.ok) return setStatus('导出 DOC 失败');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = '教师存在的问题与改进.docx';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  function downloadMarkdown() {
    if (!result) return;
    const blob = new Blob([result], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = '教师存在的问题与改进.md';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  function downloadEvidenceMarkdown() {
    if (!evidenceResult) return;
    const blob = new Blob([evidenceResult], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = '奥威亚识别.md';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  const canGenerate = Boolean(aviaFile || aviaImages.length > 0 || transcriptFile || aviaDataText.trim() || transcriptText.trim() || aiOutput.trim());

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-white">步骤2-3：奥威亚数据诊断与改进</h3>
        <p className="mt-1 text-xs text-gray-500">上传后会在后台继续识别，结果会写入教师记忆；关闭浏览器也不会中断。</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input value={teacherName} onChange={(event) => setTeacherName(event.target.value)} placeholder="教师姓名" className="rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-xs text-gray-100 placeholder-gray-500" />
        <input value={evidenceTitle} onChange={(event) => setEvidenceTitle(event.target.value)} placeholder="课例/证据名称" className="rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-xs text-gray-100 placeholder-gray-500" />
      </div>

      <input ref={aviaInputRef} type="file" accept=".pdf,.doc,.docx,.txt,.md" onChange={(event) => setAviaFile(event.target.files?.[0] || null)} className="hidden" />
      <button onClick={() => aviaInputRef.current?.click()} className="w-full rounded-lg border border-dashed border-dark-border bg-dark-bg px-3 py-2 text-sm text-gray-300 hover:border-primary hover:text-primary">
        {aviaFile ? `奥威亚数据：${aviaFile.name}` : '上传奥威亚 PDF / DOC / 文本'}
      </button>

      <input ref={aviaImageInputRef} type="file" accept="image/*" multiple onChange={(event) => setAviaImages(Array.from(event.target.files || []))} className="hidden" />
      <button onClick={() => aviaImageInputRef.current?.click()} className="w-full rounded-lg border border-dashed border-dark-border bg-dark-bg px-3 py-2 text-sm text-gray-300 hover:border-secondary hover:text-secondary">
        {aviaImages.length > 0 ? `已选择 ${aviaImages.length} 张奥威亚截图` : '上传奥威亚图表截图 / 页面截图'}
      </button>

      <textarea value={aviaDataText} onChange={(event) => setAviaDataText(event.target.value)} placeholder="粘贴奥威亚关键指标、图表文字，或人工读图后的描述" className="h-24 w-full resize-none rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-sm text-gray-100 placeholder-gray-500" />

      <input ref={transcriptInputRef} type="file" accept=".doc,.docx,.txt,.md" onChange={(event) => setTranscriptFile(event.target.files?.[0] || null)} className="hidden" />
      <button onClick={() => transcriptInputRef.current?.click()} className="w-full rounded-lg border border-dashed border-dark-border bg-dark-bg px-3 py-2 text-sm text-gray-300 hover:border-primary hover:text-primary">
        {transcriptFile ? `逐字稿：${transcriptFile.name}` : '上传课堂逐字稿 / 文本'}
      </button>

      <textarea value={transcriptText} onChange={(event) => setTranscriptText(event.target.value)} placeholder="也可以直接粘贴逐字稿片段" className="h-28 w-full resize-none rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-sm text-gray-100 placeholder-gray-500" />

      <button onClick={generate} disabled={loading || !canGenerate} className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:bg-gray-600">
        {loading ? '后台任务已提交...' : '生成教师存在的问题'}
      </button>

      {status && <p className="whitespace-pre-line rounded-lg border border-dark-border bg-dark-bg p-3 text-xs text-gray-300">{status}</p>}

      {result && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button onClick={downloadMarkdown} className="flex-1 rounded-lg border border-dark-border px-3 py-2 text-xs text-gray-300 hover:text-primary">下载 MD</button>
            <button onClick={downloadDoc} className="flex-1 rounded-lg border border-dark-border px-3 py-2 text-xs text-gray-300 hover:text-secondary">下载 DOC</button>
            {evidenceResult && <button onClick={downloadEvidenceMarkdown} className="flex-1 rounded-lg border border-dark-border px-3 py-2 text-xs text-gray-300 hover:text-secondary">下载识别 MD</button>}
          </div>
          {evidenceResult && (
            <details className="rounded-lg border border-dark-border bg-dark-bg p-3">
              <summary className="cursor-pointer text-xs font-semibold text-gray-300">查看奥威亚识别结果</summary>
              <div className="mt-3 max-h-72 overflow-y-auto border-t border-dark-border pt-3">
                <MarkdownRenderer content={evidenceResult} />
              </div>
            </details>
          )}
          <div className="max-h-80 overflow-y-auto rounded-lg border border-dark-border bg-dark-bg p-3">
            <MarkdownRenderer content={result} />
          </div>
        </div>
      )}
    </section>
  );
}
