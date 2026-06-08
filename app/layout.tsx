import type { Metadata } from 'next';
import Header from '@/components/Header';
import SidebarPanel from '@/components/sidebar/SidebarPanel';
import './globals.css';

export const metadata: Metadata = {
  title: 'AISA - Your AI Smart Assistant',
  description: 'AISA supports lesson design, essay evaluation, exam review, human-AI collaboration logs, and evidence-based teaching improvement loops.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-dark-bg">
        <Header />
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <main className="min-w-0 flex-1 min-h-[calc(100vh-120px)]">{children}</main>
            <SidebarPanel />
          </div>
        </div>
        <footer className="border-t border-dark-border py-6 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-gray-400 text-sm font-semibold">AISA</p>
            <p className="text-gray-500 text-sm mt-1">Your AI Smart Assistant</p>
            <p className="text-gray-600 text-xs mt-2">AI 生成内容需经教师审核、修改和标注后用于正式材料。</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
