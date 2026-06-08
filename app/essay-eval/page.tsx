'use client';

import { useCallback, useRef, useState } from 'react';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import type { SidebarArtifact } from '@/components/sidebar/SidebarPanel';

type Grade = '七年级' | '八年级' | '九年级';

export default function EssayEvalPage() {
  const [topic, setTopic] = useState('');
  const [essay, setEssay] = useState('');
  const [grade, setGrade] = useState<Grade>('九年级');
  const [result, setResult] = useState('');
  const [artifact, setArtifact] = useState<SidebarArtifact | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith('image/'));
    if (files.length === 0) return;
    setImages((previous) => [...previous, ...files]);
    setImagePreviews((previous) => [...previous, ...files.map((file) => URL.createObjectURL(file))]);
  }, []);

  const removeImage = useCallback((index: number) => {
    setImages((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
    setImagePreviews((previous) => {
      URL.revokeObjectURL(previous[index]);
      return previous.filter((_, itemIndex) => itemIndex !== index);
    });
  }, []);

  async function saveArtifact(content: string) {
    const response = await fetch('/api/artifacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'essay-eval',
        title: `${grade}作文形成性评价`,
        inputSummary: `年级：${grade}；题目长度：${topic.length}；作文长度：${essay.length}；图片：${images.length}张`,
        content,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '保存 AI 成果失败');
    setArtifact(data.artifact);
    window.dispatchEvent(new CustomEvent('aisa-artifact', { detail: { artifact: data.artifact, aiOutput: content } }));
  }

  const handleSubmit = useCallback(async () => {
    if (!topic.trim() && images.length === 0) {
      setError('请填写作文题目或上传图片');
      return;
    }
    if (!essay.trim() && images.length === 0) {
      setError('请输入学生作文或上传图片');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult('');
    setArtifact(null);

    try {
      const formData = new FormData();
      formData.append('topic', topic);
      formData.append('essay', essay);
      formData.append('grade', grade);
      images.forEach((image) => formData.append('images', image));

      const response = await fetch('/api/essay-eval', { method: 'POST', body: formData });
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
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setIsLoading(false);
    }
  }, [topic, essay, grade, images]);

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
      anchor.download = '作文评价报告.docx';
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
        <h1 className="text-3xl font-bold text-white mb-2">作文评价</h1>
        <p className="text-gray-400">主工作区生成形成性评价，右侧 AISA 侧边栏记录教师决策、改进任务和再证据。</p>
      </div>

      <div className="flex flex-col items-stretch gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 grid xl:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-dark-card rounded-xl p-6 border border-dark-border">
              <h2 className="text-lg font-semibold text-white mb-4">作文题目</h2>
              <textarea value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="请输入作文题目或要求..." className="w-full h-32 bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
            </div>

            <div className="bg-dark-card rounded-xl p-6 border border-dark-border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">学生作文</h2>
                <select value={grade} onChange={(event) => setGrade(event.target.value as Grade)} className="bg-dark-bg border border-dark-border rounded px-3 py-2 text-gray-100 focus:outline-none">
                  <option value="七年级">七年级</option>
                  <option value="八年级">八年级</option>
                  <option value="九年级">九年级</option>
                </select>
              </div>
              <textarea value={essay} onChange={(event) => setEssay(event.target.value)} placeholder="请粘贴学生作文..." className="w-full h-64 bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
            </div>

            <div className="bg-dark-card rounded-xl p-6 border border-dark-border">
              <h2 className="text-lg font-semibold text-white mb-4">上传作文图片</h2>
              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageSelect} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="w-full py-3 border-2 border-dashed border-dark-border rounded-lg text-gray-400 hover:border-primary hover:text-primary transition-colors">点击上传图片</button>
              {imagePreviews.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {imagePreviews.map((src, index) => (
                    <div key={src} className="relative group">
                      <img src={src} alt={`作文图片${index + 1}`} className="w-full h-24 object-cover rounded-lg border border-dark-border" />
                      <button onClick={() => removeImage(index)} className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button onClick={handleSubmit} disabled={isLoading || ((!topic.trim() || !essay.trim()) && images.length === 0)} className="w-full py-4 bg-primary hover:bg-primary/90 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors">
              {isLoading ? '评价并保存中...' : '开始评价'}
            </button>
            {error && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">{error}</div>}
          </div>

          <div className="bg-dark-card rounded-xl p-6 border border-dark-border min-h-[680px]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">评价报告</h2>
              {result && (
                <div className="flex gap-3">
                  <button onClick={() => navigator.clipboard.writeText(result)} className="text-sm text-gray-400 hover:text-primary transition-colors">复制</button>
                  <button onClick={downloadDoc} className="text-sm text-gray-400 hover:text-secondary transition-colors">下载 DOC</button>
                </div>
              )}
            </div>
            <div data-ai-output="true" data-ai-label="AI生成" className="h-[calc(100%-60px)] overflow-y-auto">
              {result ? <MarkdownRenderer content={result} /> : <div className="h-full flex items-center justify-center text-gray-500">{isLoading ? '正在分析作文...' : '评价报告将在这里显示'}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
