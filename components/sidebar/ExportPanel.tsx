'use client';

import { useEffect, useState } from 'react';

export default function ExportPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState('');
  const [videoScript, setVideoScript] = useState('');
  const [infoText, setInfoText] = useState('');

  useEffect(() => {
    async function load() {
      const response = await fetch('/api/case-materials');
      const data = await response.json();
      setReport(data.report || '');
      setVideoScript(data.videoScript || '');
      const info = data.infoTable;
      setInfoText(info ? `案例名称：${info.caseName}\n作者：${info.author}\n场景：${info.scenario}\nAI成果：${info.evidenceCount}\n反思记录：${info.reflectionCount}\n闭环任务：${info.improvementTaskCount}\nAI标注：本材料由 AISA 辅助生成，教师审核后提交。` : '');
    }
    load();
  }, [refreshKey]);

  function downloadText(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

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

  const compliance = [
    '主页面 AI 输出已添加 data-ai-output 标记',
    '侧边栏对话内容标注“AI生成”',
    '导出材料包含 AI 辅助生成说明',
  ];

  return (
    <section className="rounded-xl border border-dark-border bg-dark-card">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <span className="font-semibold text-white">统一导出与合规</span>
        <span className="text-sm text-gray-400">{open ? '收起' : '展开'}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-dark-border p-4">
          <button onClick={downloadDoc} className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white">导出报告 Word</button>
          <button onClick={() => downloadText(infoText, '案例信息表.txt')} className="w-full rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-sm text-gray-200">导出信息表</button>
          <button onClick={() => downloadText(videoScript, '视频脚本.txt')} className="w-full rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-sm text-gray-200">导出视频脚本</button>
          <div className="rounded-lg border border-dark-border bg-dark-bg p-3">
            <div className="mb-2 text-xs font-semibold text-white">合规检查</div>
            <ul className="space-y-1 text-xs text-gray-400">
              {compliance.map((item) => <li key={item}>- {item}</li>)}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

