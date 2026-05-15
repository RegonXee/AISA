'use client';

import { useState, useCallback, useRef } from 'react';
import MarkdownRenderer from '@/components/MarkdownRenderer';

type Grade = '七年级' | '八年级' | '九年级';
type Period = '1课时' | '2课时' | '3课时';

export default function LessonDesignPage() {
  const [text, setText] = useState('');
  const [grade, setGrade] = useState<Grade>('八年级');
  const [period, setPeriod] = useState<Period>('2课时');
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
    if (!text.trim() && images.length === 0) {
      setError('请输入课文内容或上传图片');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult('');

    try {
      const formData = new FormData();
      formData.append('text', text);
      formData.append('grade', grade);
      formData.append('period', period);
      images.forEach(img => formData.append('images', img));

      const response = await fetch('/api/lesson-design', {
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
  }, [text, grade, period, images]);

  const copyResult = useCallback(() => {
    navigator.clipboard.writeText(result);
  }, [result]);

  const downloadResult = useCallback(() => {
    const blob = new Blob([result], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '教案设计.md';
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
      a.download = '教案设计.docx';
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
        <h1 className="text-3xl font-bold text-white mb-2">教案设计</h1>
        <p className="text-gray-400">
          输入课文内容或上传图片，选择年级和课时数，AI将生成完整的教学设计
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* 左侧：输入区 */}
        <div className="space-y-6">
          <div className="bg-dark-card rounded-xl p-6 border border-dark-border">
            <h2 className="text-lg font-semibold text-white mb-4">课文内容</h2>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="请粘贴课文内容..."
              className="w-full h-64 bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {/* 图片上传 */}
          <div className="bg-dark-card rounded-xl p-6 border border-dark-border">
            <h2 className="text-lg font-semibold text-white mb-4">上传课文图片</h2>
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

          <div className="bg-dark-card rounded-xl p-6 border border-dark-border">
            <h2 className="text-lg font-semibold text-white mb-4">参数设置</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm text-gray-400 mb-2">年级</label>
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value as Grade)}
                  className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2.5 text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="七年级">七年级</option>
                  <option value="八年级">八年级</option>
                  <option value="九年级">九年级</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">课时数</label>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as Period)}
                  className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2.5 text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="1课时">1课时</option>
                  <option value="2课时">2课时</option>
                  <option value="3课时">3课时</option>
                </select>
              </div>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={isLoading || (!text.trim() && images.length === 0)}
            className="w-full py-4 bg-primary hover:bg-primary/90 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                生成中...
              </span>
            ) : (
              '生成教案'
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
            <h2 className="text-lg font-semibold text-white">生成结果</h2>
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
                    <p>正在生成教案，请稍候...</p>
                  </div>
                ) : (
                  <p>输入课文内容或上传图片后，点击"生成教案"按钮</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
