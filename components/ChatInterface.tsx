'use client';

import { useState, useRef, useCallback } from 'react';
import MarkdownRenderer from './MarkdownRenderer';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatInterfaceProps {
  onSubmit: (message: string, onChunk: (chunk: string) => void, onComplete: () => void, onError: (error: Error) => void) => void;
  placeholder?: string;
}

export default function ChatInterface({ onSubmit, placeholder = '请输入内容...' }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentResponse, setCurrentResponse] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);
    setCurrentResponse('');

    onSubmit(
      userMessage.content,
      (chunk) => {
        setCurrentResponse((prev) => prev + chunk);
        scrollToBottom();
      },
      () => {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: currentResponse,
          },
        ]);
        setIsLoading(false);
        setCurrentResponse('');
      },
      (err) => {
        setError(err.message);
        setIsLoading(false);
        setCurrentResponse('');
      }
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="flex flex-col h-full bg-dark-bg rounded-lg border border-dark-border">
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg p-4 ${
                message.role === 'user'
                  ? 'bg-primary text-white'
                  : 'bg-dark-card text-gray-100'
              }`}
            >
              <div className="prose prose-invert max-w-none">
                <MarkdownRenderer content={message.content} />
              </div>
              {message.role === 'assistant' && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-dark-border">
                  <button
                    onClick={() => copyToClipboard(message.content)}
                    className="text-xs text-gray-400 hover:text-primary transition-colors"
                  >
                    复制
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* 正在生成的响应 */}
        {isLoading && currentResponse && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg p-4 bg-dark-card text-gray-100">
              <div className="prose prose-invert max-w-none">
                <MarkdownRenderer content={currentResponse} />
              </div>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-dark-border">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                <span className="text-xs text-gray-400">生成中...</span>
              </div>
            </div>
          </div>
        )}

        {/* 加载状态 */}
        {isLoading && !currentResponse && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg p-4 bg-dark-card">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse delay-75"></div>
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse delay-150"></div>
                <span className="text-sm text-gray-400">正在思考...</span>
              </div>
            </div>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="flex justify-center">
            <div className="max-w-[85%] rounded-lg p-4 bg-red-500/10 border border-red-500/30 text-red-400">
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-dark-border">
        <div className="flex gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder={placeholder}
            disabled={isLoading}
            className="flex-1 bg-dark-card border border-dark-border rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary resize-none min-h-[80px]"
            rows={3}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-6 py-3 bg-primary hover:bg-primary/90 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {isLoading ? '生成中' : '发送'}
          </button>
        </div>
      </form>
    </div>
  );
}
