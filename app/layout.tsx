import type { Metadata } from 'next';
import Header from '@/components/Header';
import './globals.css';

export const metadata: Metadata = {
  title: '初中英语教学AI助手 - 教案设计 | 作文评价 | 试卷评讲',
  description: '基于DeepSeek AI的初中英语教学助手，提供教案设计、作文评价、试卷评讲等功能',
  keywords: '初中英语, 教学助手, AI, DeepSeek, 教案设计, 作文评价, 试卷评讲',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-dark-bg">
        <Header />
        <main className="min-h-[calc(100vh-80px)]">
          {children}
        </main>
        <footer className="border-t border-dark-border py-6 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-gray-500 text-sm">
              初中英语教学AI助手 · Powered by DeepSeek AI
            </p>
            <p className="text-gray-600 text-xs mt-2">
              本工具仅供教学辅助使用，AI生成内容仅供参考
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
