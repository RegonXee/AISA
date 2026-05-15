'use client';

import { useState, useCallback, useRef } from 'react';
import MarkdownRenderer from '@/components/MarkdownRenderer';

export default function ExamReviewPage() {
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [examImages, setExamImages] = useState<File[]>([]);
  const [examFile, setExamFile] = useState<File | null>(null);
  const [examText, setExamText] = useState('');
  const [result, setResult] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const examImageRef = useRef<HTMLInputElement>(null);
  const examFileRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(async () => {
    if (!excelFile) { setError('请上传成绩Excel文件'); return; }
    if (examImages.length === 0 && !examFile && !examText.trim()) {
      setError('请上传试卷图片、试卷文件或输入试卷内容'); return;
    }

    setIsLoading(true);
    setError(null);
    setResult('');

    try {
      const formData = new FormData();
      formData.append('excel', excelFile);
      examImages.forEach((img) => formData.append('examImages', img));
      if (examFile) formData.append('exam', examFile);
      formData.append('examText', examText);

      const response = await fetch('/api/exam-review', {
        method: 'POST',
        body: formData,
      });

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
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setIsLoading(false);
    }
  }, [excelFile, examImages, examFile, examText]);

  const copyResult = useCallback(() => { navigator.clipboard.writeText(result); }, [result]);

  const downloadResult = useCallback(() => {
    const blob = new Blob([result], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = '试卷评讲方案.md';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }, [result]);

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
      const a = document.createElement('a'); a.href = url; a.download = '试卷评讲方案.docx';
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (err) { setError(err instanceof Error ? err.message : '下载失败'); }
  }, [result]);

  const hasExamInput = examImages.length > 0 || !!examFile || examText.trim().length > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">试卷评讲</h1>
        <p className="text-gray-400">上传成绩Excel和试卷，AI将分析错误率并生成评讲方案</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          {/* Excel */}
          <div className="bg-dark-card rounded-xl p-6 border border-dark-border">
            <h2 className="text-lg font-semibold text-white mb-4">上传成绩Excel</h2>
            <input ref={excelInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) setExcelFile(f); }} className="hidden" />
            <button onClick={() => excelInputRef.current?.click()} className="w-full py-3 border-2 border-dashed border-dark-border rounded-lg text-gray-400 hover:border-primary hover:text-primary transition-colors">点击上传Excel文件</button>
            {excelFile && <p className="mt-3 text-sm text-green-400">✓ {excelFile.name}</p>}
          </div>

          {/* 试卷图片 */}
          <div className="bg-dark-card rounded-xl p-6 border border-dark-border">
            <h2 className="text-lg font-semibold text-white mb-2">上传试卷图片（推荐）</h2>
            <p className="text-sm text-gray-500 mb-4">拍照或截图，通过OCR识别文字</p>
            <input ref={examImageRef} type="file" accept="image/*" multiple onChange={(e) => { const files = Array.from(e.target.files || []); setExamImages(prev => [...prev, ...files]); }} className="hidden" />
            <button onClick={() => examImageRef.current?.click()} className="w-full py-3 border-2 border-dashed border-dark-border rounded-lg text-gray-400 hover:border-primary hover:text-primary transition-colors">点击上传试卷图片（支持多张）</button>
            {examImages.length > 0 && (
              <div className="mt-3 space-y-1">
                {examImages.map((img, i) => (
                  <div key={i} className="flex items-center justify-between text-sm text-green-400">
                    <span>✓ {img.name}</span>
                    <button onClick={() => setExamImages(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-300">删除</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 试卷文件 */}
          <div className="bg-dark-card rounded-xl p-6 border border-dark-border">
            <h2 className="text-lg font-semibold text-white mb-2">上传试卷文件（备选）</h2>
            <p className="text-sm text-gray-500 mb-4">支持.docx/.doc/.txt</p>
            <input ref={examFileRef} type="file" accept=".docx,.doc,.txt" onChange={(e) => { const f = e.target.files?.[0]; if (f) setExamFile(f); }} className="hidden" />
            <button onClick={() => examFileRef.current?.click()} className="w-full py-3 border-2 border-dashed border-dark-border rounded-lg text-gray-400 hover:border-primary hover:text-primary transition-colors">点击上传试卷文件</button>
            {examFile && <p className="mt-3 text-sm text-green-400">✓ {examFile.name}</p>}
            <div className="mt-4">
              <label className="block text-sm text-gray-400 mb-2">或粘贴试卷内容</label>
              <textarea value={examText} onChange={(e) => setExamText(e.target.value)} placeholder="如果文件上传有问题，请在此粘贴..." className="w-full h-32 bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
            </div>
          </div>

          <button onClick={handleSubmit} disabled={isLoading || !excelFile || !hasExamInput} className="w-full py-4 bg-primary hover:bg-primary/90 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors">
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                生成评讲方案...
              </span>
            ) : '生成评讲方案'}
          </button>

          {error && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">{error}</div>}
        </div>

        <div className="bg-dark-card rounded-xl p-6 border border-dark-border min-h-[600px]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">评讲方案</h2>
            {result && (
              <div className="flex gap-3">
                <button onClick={copyResult} className="text-sm text-gray-400 hover:text-primary transition-colors">复制</button>
                <button onClick={downloadResult} className="text-sm text-gray-400 hover:text-secondary transition-colors">下载MD</button>
                <button onClick={downloadDoc} className="text-sm text-gray-400 hover:text-secondary transition-colors">下载DOC</button>
              </div>
            )}
          </div>
          <div className="h-[calc(100%-60px)] overflow-y-auto">
            {result ? (
              <div className="prose prose-invert max-w-none"><MarkdownRenderer content={result} /></div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                {isLoading ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                    <p>正在分析数据，请稍候...</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p>上传成绩和试卷后，点击"生成评讲方案"</p>
                    <p className="text-sm mt-2 text-gray-600">系统将按错误率从高到低生成评讲顺序</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
