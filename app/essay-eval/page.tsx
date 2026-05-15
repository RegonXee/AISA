'use client';

import { useState, useCallback, useRef } from 'react';
import MarkdownRenderer from '@/components/MarkdownRenderer';

type Grade = '七年级' | '八年级' | '九年级';

export default function EssayEvalPage() {
  const [topic, setTopic] = useState('');
  const [essay, setEssay] = useState('');
  const [grade, setGrade] = useState<Grade>('九年级');
  const [result, setResult] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (newFiles.length === 0) return;
    setImages(prev => [...prev, ...newFiles]);
    const newPreviews = newFiles.map(f => URL.createObjectURL(f));
    setImagePreviews(prev => [...prev, ...newPreviews]);
  }, []);

  const removeImage = useCallback((index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

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

    try {
      const formData = new FormData();
      formData.append('topic', topic);
      formData.append('essay', essay);
      formData.append('grade', grade);
      images.forEach(img => formData.append('images', img));

      const response = await fetch('/api/essay-eval', {
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

        const chunk = decoder.decode(value, { stream: true });
        fullResponse += chunk;
        setResult(fullResponse);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setIsLoading(false);
    }
  }, [topic, essay, grade, images]);

  const copyResult = useCallback(() => {
    navigator.clipboard.writeText(result);
  }, [result]);

  const downloadResult = useCallback(() => {
    const blob = new Blob([result], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '作文评价报告.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
      const a = document.createElement('a');
      a.href = url;
      a.download = '作文评价报告.docx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : '下载失败');
    }
  }, [result]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">作文评价</h1>
        <p className="text-gray-400">
          输入作文题目和学生作文或上传图片，AI将进行形成性评价并给出改进建议
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* 左侧：输入区 */}
        <div className="space-y-6">
          <div className="bg-dark-card rounded-xl p-6 border border-dark-border">
            <h2 className="text-lg font-semibold text-white mb-4">作文题目</h2>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="请输入作文题目或要求..."
              className="w-full h-32 bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          <div className="bg-dark-card rounded-xl p-6 border border-dark-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">学生作文</h2>
              <label className="text-sm text-gray-400">
                年级：
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value as Grade)}
                  className="ml-2 bg-dark-bg border border-dark-border rounded px-2 py-1 text-gray-100 focus:outline-none"
                >
                  <option value="七年级">七年级</option>
                  <option value="八年级">八年级</option>
                  <option value="九年级">九年级</option>
                </select>
              </label>
            </div>
            <textarea
              value={essay}
              onChange={(e) => setEssay(e.target.value)}
              placeholder="请粘贴学生作文..."
              className="w-full h-64 bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {/* 图片上传 */}
          <div className="bg-dark-card rounded-xl p-6 border border-dark-border">
            <h2 className="text-lg font-semibold text-white mb-4">上传作文图片</h2>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/jpg"
              multiple
              onChange={handleImageSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 border-2 border-dashed border-dark-border rounded-lg text-gray-400 hover:border-primary hover:text-primary transition-colors"
            >
              点击上传图片（支持多张）
            </button>
            {imagePreviews.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-3">
                {imagePreviews.map((src, i) => (
                  <div key={i} className="relative group">
                    <img src={src} alt={`图片${i+1}`} className="w-full h-24 object-cover rounded-lg border border-dark-border" />
                    <button
                      onClick={() => removeImage(i)}
                      className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={isLoading || ((!topic.trim() || !essay.trim()) && images.length === 0)}
            className="w-full py-4 bg-primary hover:bg-primary/90 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                评价中...
              </span>
            ) : (
              '开始评价'
            )}
          </button>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* 右侧：输出区 */}
        <div className="bg-dark-card rounded-xl p-6 border border-dark-border min-h-[600px]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">评价报告</h2>
            {result && (
              <div className="flex gap-3">
                <button
                  onClick={copyResult}
                  className="text-sm text-gray-400 hover:text-primary transition-colors"
                >
                  复制
                </button>
                <button
                  onClick={downloadResult}
                  className="text-sm text-gray-400 hover:text-secondary transition-colors"
                >
                  下载MD
                </button>
                <button
                  onClick={downloadDoc}
                  className="text-sm text-gray-400 hover:text-secondary transition-colors"
                >
                  下载DOC
                </button>
              </div>
            )}
          </div>
          
          <div className="h-[calc(100%-60px)] overflow-y-auto">
            {result ? (
              <div className="prose prose-invert max-w-none">
                <MarkdownRenderer content={result} />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                {isLoading ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                    <p>正在分析作文，请稍候...</p>
                  </div>
                ) : (
                  <p>输入作文内容或上传图片后，点击"开始评价"按钮</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
