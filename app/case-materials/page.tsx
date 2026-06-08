'use client';

import { useEffect, useState } from 'react';
import MarkdownRenderer from '@/components/MarkdownRenderer';

interface InfoTable {
  caseName: string;
  author: string;
  scenario: string;
  evidenceCount: number;
  reflectionCount: number;
  improvementTaskCount: number;
}

export default function CaseMaterialsPage() {
  const [report, setReport] = useState('');
  const [videoScript, setVideoScript] = useState('');
  const [infoTable, setInfoTable] = useState<InfoTable | null>(null);

  useEffect(() => {
    async function load() {
      const response = await fetch('/api/case-materials');
      const data = await response.json();
      setReport(data.report || '');
      setVideoScript(data.videoScript || '');
      setInfoTable(data.infoTable || null);
    }
    load();
  }, []);

  async function downloadDoc() {
    const response = await fetch('/api/export-doc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown: report }),
    });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = '案例总结报告草稿.docx';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  function downloadText(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  const infoMarkdown = infoTable ? `# 案例信息表

- 案例名称：${infoTable.caseName}
- 作者：${infoTable.author}
- 应用场景：${infoTable.scenario}
- AI 成果数量：${infoTable.evidenceCount}
- 教师反思记录：${infoTable.reflectionCount}
- 改进闭环任务：${infoTable.improvementTaskCount}
- AI 生成内容标注：本材料由 AISA 基于系统记录生成草稿，需教师审核后提交。` : '';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">案例材料自动生成</h1>
          <p className="text-gray-400">根据协同记录、闭环证据和教师画像生成报告草稿、信息表与视频脚本。</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={downloadDoc} className="px-4 py-3 bg-primary hover:bg-primary/90 text-white font-semibold rounded-lg transition-colors">
            下载报告 DOC
          </button>
          <button onClick={() => downloadText(infoMarkdown, '案例信息表.txt')} className="px-4 py-3 bg-dark-card border border-dark-border hover:border-primary text-gray-200 font-semibold rounded-lg transition-colors">
            下载信息表
          </button>
          <button onClick={() => downloadText(videoScript, '视频脚本.txt')} className="px-4 py-3 bg-dark-card border border-dark-border hover:border-primary text-gray-200 font-semibold rounded-lg transition-colors">
            下载视频脚本
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <section className="bg-dark-card border border-dark-border rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-5">案例总结报告草稿</h2>
          {report ? <MarkdownRenderer content={report} /> : <p className="text-gray-400">正在生成报告...</p>}
        </section>

        <aside className="space-y-6">
          <section className="bg-dark-card border border-dark-border rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-5">案例信息表</h2>
            {infoTable ? (
              <div className="space-y-3 text-sm text-gray-300">
                <p><span className="text-gray-500">名称：</span>{infoTable.caseName}</p>
                <p><span className="text-gray-500">作者：</span>{infoTable.author}</p>
                <p><span className="text-gray-500">场景：</span>{infoTable.scenario}</p>
                <p><span className="text-gray-500">成果：</span>{infoTable.evidenceCount} 条</p>
                <p><span className="text-gray-500">反思：</span>{infoTable.reflectionCount} 条</p>
                <p><span className="text-gray-500">闭环：</span>{infoTable.improvementTaskCount} 个</p>
              </div>
            ) : <p className="text-gray-400">正在读取...</p>}
          </section>

          <section className="bg-dark-card border border-dark-border rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-5">视频脚本</h2>
            <pre className="whitespace-pre-wrap text-sm text-gray-300 leading-relaxed">{videoScript}</pre>
          </section>

          <section className="bg-dark-card border border-dark-border rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-3">合规检查</h2>
            <p className="text-sm text-gray-300 leading-relaxed">
              系统已在材料中加入 AI 生成内容说明。正式提交前，请教师核对事实、补充真实课堂证据，并保留“AI 生成、教师审核修改”的标注。
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

