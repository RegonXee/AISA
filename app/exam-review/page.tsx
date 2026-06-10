'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import type { SidebarArtifact } from '@/components/sidebar/SidebarPanel';

const PAGE_KEY = 'exam-review';

export default function ExamReviewPage() {
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [examImages, setExamImages] = useState<File[]>([]);
  const [examFile, setExamFile] = useState<File | null>(null);
  const [examText, setExamText] = useState('');
  const [result, setResult] = useState('');
  const [artifact, setArtifact] = useState<SidebarArtifact | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const examImageRef = useRef<HTMLInputElement>(null);
  const examFileRef = useRef<HTMLInputElement>(null);
  const hasExamInput = examImages.length > 0 || !!examFile || examText.trim().length > 0;

  const savePageMemory = useCallback(async (output = result) => {
    await fetch('/api/page-memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pageKey: PAGE_KEY,
        input: {
          examText,
          excelFileName: excelFile?.name || '',
          examFileName: examFile?.name || '',
          examImageNames: examImages.map((image) => image.name),
        },
        output,
      }),
    }).catch(() => undefined);
  }, [examFile, examImages, examText, excelFile, result]);

  const loadPageMemory = useCallback(async () => {
    const response = await fetch(`/api/page-memory?pageKey=${PAGE_KEY}`);
    if (!response.ok) return;
    const data = await response.json();
    const memory = data.memory;
    if (!memory) return;
    const input = memory.input || {};
    setExamText(typeof input.examText === 'string' ? input.examText : '');
    setResult(typeof memory.output === 'string' ? memory.output : '');
  }, []);

  useEffect(() => {
    loadPageMemory();
    window.addEventListener('aisa-login', loadPageMemory);
    return () => window.removeEventListener('aisa-login', loadPageMemory);
  }, [loadPageMemory]);

  async function saveArtifact(content: string) {
    const response = await fetch('/api/artifacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'exam-review',
        title: '试卷讲评与数据诊断方案',
        inputSummary: `成绩文件：${excelFile?.name || '未上传'}；试卷图片：${examImages.length}张；试卷文件：${examFile?.name || '无'}；手动文本：${examText.length}字`,
        content,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '保存 AI 成果失败');
    setArtifact(data.artifact);
    window.dispatchEvent(new CustomEvent('aisa-artifact', { detail: { artifact: data.artifact, aiOutput: content } }));
  }

  const handleSubmit = useCallback(async () => {
    if (!excelFile) {
      setError('请上传成绩 Excel 文件');
      return;
    }
    if (!hasExamInput) {
      setError('请上传试卷图片、试卷文件或输入试卷内容');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult('');
    setArtifact(null);

    try {
      const formData = new FormData();
      formData.append('excel', excelFile);
      examImages.forEach((image) => formData.append('examImages', image));
      if (examFile) formData.append('exam', examFile);
      formData.append('examText', examText);

      const response = await fetch('/api/exam-review', { method: 'POST', body: formData });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '请求失败');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应');
      const decoder = new TextDecoder();
      let fullResponse = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullResponse += decoder.decode(value, { stream: true });
        setResult(fullResponse);
      }
      await saveArtifact(fullResponse);
      await savePageMemory(fullResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setIsLoading(false);
    }
  }, [excelFile, examImages, examFile, examText, hasExamInput, savePageMemory]);

  const downloadDoc = useCallback(async () => {
    try {
      const response = await fetch('/api/export-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown: result }),
      });
      if (!response.ok) throw new Error('转换失败');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = '试卷讲评方案.docx';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : '下载失败');
    }
  }, [result]);

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">试卷讲评</h1>
        <p className="text-gray-400">成绩表会先自动识别题号/表头，识别失败再回退固定列格式；右侧侧边栏记录教师修改 AI 建议的过程。</p>
      </div>

      <div className="flex flex-col items-stretch gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 grid xl:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-dark-card rounded-xl p-6 border border-dark-border">
              <h2 className="text-lg font-semibold text-white mb-4">成绩 Excel</h2>
              <input ref={excelInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={(event) => setExcelFile(event.target.files?.[0] || null)} className="hidden" />
              <button onClick={() => excelInputRef.current?.click()} className="w-full py-3 border-2 border-dashed border-dark-border rounded-lg text-gray-400 hover:border-primary hover:text-primary transition-colors">点击上传成绩文件</button>
              {excelFile && <p className="mt-3 text-sm text-green-400">{excelFile.name}</p>}
            </div>

            <div className="bg-dark-card rounded-xl p-6 border border-dark-border">
              <h2 className="text-lg font-semibold text-white mb-2">试卷图片</h2>
              <p className="text-sm text-gray-500 mb-4">支持多张图片，系统将通过 OCR 识别文字。</p>
              <input ref={examImageRef} type="file" accept="image/*" multiple onChange={(event) => setExamImages((previous) => [...previous, ...Array.from(event.target.files || [])])} className="hidden" />
              <button onClick={() => examImageRef.current?.click()} className="w-full py-3 border-2 border-dashed border-dark-border rounded-lg text-gray-400 hover:border-primary hover:text-primary transition-colors">点击上传试卷图片</button>
              {examImages.length > 0 && (
                <div className="mt-3 space-y-2">
                  {examImages.map((image, index) => (
                    <div key={`${image.name}-${index}`} className="flex items-center justify-between text-sm text-green-400">
                      <span>{image.name}</span>
                      <button onClick={() => setExamImages((previous) => previous.filter((_, itemIndex) => itemIndex !== index))} className="text-red-400 hover:text-red-300">删除</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-dark-card rounded-xl p-6 border border-dark-border">
              <h2 className="text-lg font-semibold text-white mb-2">试卷文件或文本</h2>
              <input ref={examFileRef} type="file" accept=".docx,.doc,.txt" onChange={(event) => setExamFile(event.target.files?.[0] || null)} className="hidden" />
              <button onClick={() => examFileRef.current?.click()} className="w-full py-3 border-2 border-dashed border-dark-border rounded-lg text-gray-400 hover:border-primary hover:text-primary transition-colors">点击上传试卷文件</button>
              {examFile && <p className="mt-3 text-sm text-green-400">{examFile.name}</p>}
              <textarea value={examText} onChange={(event) => setExamText(event.target.value)} placeholder="也可以直接粘贴试卷内容..." className="mt-4 w-full h-32 bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
            </div>

            <button onClick={handleSubmit} disabled={isLoading || !excelFile || !hasExamInput} className="w-full py-4 bg-primary hover:bg-primary/90 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors">
              {isLoading ? '生成并保存中...' : '生成讲评方案'}
            </button>
            {error && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">{error}</div>}
          </div>

          <div className="bg-dark-card rounded-xl p-6 border border-dark-border min-h-[680px]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">讲评方案</h2>
              {result && (
                <div className="flex gap-3">
                  <button onClick={() => navigator.clipboard.writeText(result)} className="text-sm text-gray-400 hover:text-primary transition-colors">复制</button>
                  <button onClick={downloadDoc} className="text-sm text-gray-400 hover:text-secondary transition-colors">下载 DOC</button>
                </div>
              )}
            </div>
            <div data-ai-output="true" data-ai-label="AI生成" className="h-[calc(100%-60px)] overflow-y-auto">
              {result ? <MarkdownRenderer content={result} /> : <div className="h-full flex items-center justify-center text-gray-500">{isLoading ? '正在分析数据...' : '讲评方案将在这里显示'}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
