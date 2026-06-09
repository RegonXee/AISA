'use client';

import { useRef, useState } from 'react';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import type { SidebarArtifact } from './SidebarPanel';

interface Props {
  aiOutput: string;
  artifact: SidebarArtifact | null;
  onSaved?: () => void;
}

export default function StepAviaDiagnosis({ aiOutput, artifact, onSaved }: Props) {
  const aviaInputRef = useRef<HTMLInputElement>(null);
  const aviaImageInputRef = useRef<HTMLInputElement>(null);
  const transcriptInputRef = useRef<HTMLInputElement>(null);
  const [teacherName, setTeacherName] = useState('');
  const [evidenceTitle, setEvidenceTitle] = useState('');
  const [aviaFile, setAviaFile] = useState<File | null>(null);
  const [aviaImages, setAviaImages] = useState<File[]>([]);
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [aviaDataText, setAviaDataText] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const [result, setResult] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  function readPageText(selector: string) {
    const node = document.querySelector(selector);
    if (node instanceof HTMLTextAreaElement || node instanceof HTMLInputElement) return node.value;
    return node?.textContent?.trim() || '';
  }

  async function generate() {
    setLoading(true);
    setStatus('');
    setResult('');
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
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '生成教师问题诊断失败');
      setResult(data.markdown || data.record?.markdown || '');
      setStatus('已保存为教师“存在的问题与改进”Markdown 记录。');
      onSaved?.();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '生成教师问题诊断失败');
    } finally {
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

  const canGenerate = Boolean(aviaFile || aviaImages.length > 0 || transcriptFile || aviaDataText.trim() || transcriptText.trim() || aiOutput.trim());

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-white">步骤2-3：奥威亚数据诊断与改进</h3>
        <p className="mt-1 text-xs text-gray-500">读取奥威亚系统数据和课堂逐字稿，生成“教师存在的问题与改进”文档，并写入教师画像时间轴。</p>
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
        {aviaImages.length > 0 ? `已选择 ${aviaImages.length} 张图表截图` : '上传奥威亚图表截图 / 页面截图'}
      </button>

      <textarea value={aviaDataText} onChange={(event) => setAviaDataText(event.target.value)} placeholder="粘贴奥威亚关键指标、图表文字，或视觉模型/人工读图后的描述：师生话语占比、互动次数、板书率、课堂活动时长等。若板书率为0等明显异常，请注明统计可能有偏差。" className="h-24 w-full resize-none rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-sm text-gray-100 placeholder-gray-500" />

      <input ref={transcriptInputRef} type="file" accept=".doc,.docx,.txt,.md" onChange={(event) => setTranscriptFile(event.target.files?.[0] || null)} className="hidden" />
      <button onClick={() => transcriptInputRef.current?.click()} className="w-full rounded-lg border border-dashed border-dark-border bg-dark-bg px-3 py-2 text-sm text-gray-300 hover:border-primary hover:text-primary">
        {transcriptFile ? `逐字稿：${transcriptFile.name}` : '上传课堂逐字稿 DOC / 文本'}
      </button>

      <textarea value={transcriptText} onChange={(event) => setTranscriptText(event.target.value)} placeholder="也可以直接粘贴逐字稿片段，帮助 AI 判断教师提问、学生回应、活动推进和目标达成。" className="h-28 w-full resize-none rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-sm text-gray-100 placeholder-gray-500" />

      <button onClick={generate} disabled={loading || !canGenerate} className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:bg-gray-600">
        {loading ? '生成并保存中...' : '生成教师存在的问题文档'}
      </button>

      {status && <p className="rounded-lg border border-dark-border bg-dark-bg p-3 text-xs text-gray-300">{status}</p>}

      {result && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button onClick={downloadMarkdown} className="flex-1 rounded-lg border border-dark-border px-3 py-2 text-xs text-gray-300 hover:text-primary">下载 MD</button>
            <button onClick={downloadDoc} className="flex-1 rounded-lg border border-dark-border px-3 py-2 text-xs text-gray-300 hover:text-secondary">下载 DOC</button>
          </div>
          <div className="max-h-80 overflow-y-auto rounded-lg border border-dark-border bg-dark-bg p-3">
            <MarkdownRenderer content={result} />
          </div>
        </div>
      )}
    </section>
  );
}
