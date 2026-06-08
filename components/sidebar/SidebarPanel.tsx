'use client';

import { useEffect, useState } from 'react';
import ChatWindow from './ChatWindow';
import ProfileDrawer from './ProfileDrawer';
import RegisterForm from './RegisterForm';
import StepAIAnalysis from './StepAIAnalysis';
import StepDecision from './StepDecision';
import StepImprovement from './StepImprovement';
import StepIndicator from './StepIndicator';
import StepVerification from './StepVerification';

export interface SidebarArtifact {
  id: string;
  kind: 'lesson-design' | 'essay-eval' | 'exam-review';
  title: string;
}

export default function SidebarPanel({
  aiOutput: externalAiOutput,
  artifact: externalArtifact,
}: {
  aiOutput?: string;
  artifact?: SidebarArtifact | null;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pageAiOutput, setPageAiOutput] = useState('');
  const [pageArtifact, setPageArtifact] = useState<SidebarArtifact | null>(null);

  const refresh = () => setRefreshKey((value) => value + 1);
  const aiOutput = externalAiOutput ?? pageAiOutput;
  const artifact = externalArtifact ?? pageArtifact;

  useEffect(() => {
    const readOutput = () => {
      const node = document.querySelector('[data-ai-output="true"]');
      setPageAiOutput(node?.textContent?.trim() || '');
    };
    const handleArtifact = (event: Event) => {
      const detail = (event as CustomEvent<{ artifact?: SidebarArtifact; aiOutput?: string }>).detail;
      if (detail?.artifact) setPageArtifact(detail.artifact);
      if (detail?.aiOutput) setPageAiOutput(detail.aiOutput);
    };
    const handleLogin = () => setRefreshKey((value) => value + 1);

    readOutput();
    const observer = new MutationObserver(readOutput);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener('aisa-artifact', handleArtifact);
    window.addEventListener('aisa-login', handleLogin);
    return () => {
      observer.disconnect();
      window.removeEventListener('aisa-artifact', handleArtifact);
      window.removeEventListener('aisa-login', handleLogin);
    };
  }, []);

  if (collapsed) {
    return (
      <aside className="w-full shrink-0 lg:sticky lg:top-20 lg:h-[calc(100vh-96px)] lg:w-14">
        <button
          onClick={() => setCollapsed(false)}
          className="h-12 w-full rounded-xl border border-dark-border bg-dark-card text-sm font-semibold text-primary lg:h-full"
        >
          侧边栏
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-full shrink-0 overflow-y-auto rounded-xl border border-dark-border bg-dark-card/80 p-4 lg:sticky lg:top-20 lg:h-[calc(100vh-96px)] lg:w-[400px]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">AISA 协同侧边栏</h2>
          <p className="text-xs text-gray-500">AI分析 → 教师决策 → 实施改进 → 验证成效</p>
        </div>
        <button onClick={() => setCollapsed(true)} className="rounded-lg border border-dark-border px-2 py-1 text-xs text-gray-400">
          折叠
        </button>
      </div>

      <div className="space-y-4">
        <StepIndicator currentStep={currentStep} onChange={setCurrentStep} />

        <div className="rounded-xl border border-dark-border bg-dark-card p-4">
          {currentStep === 0 && <StepAIAnalysis aiOutput={aiOutput} />}
          {currentStep === 1 && <StepDecision artifact={artifact} onSaved={refresh} />}
          {currentStep === 2 && <StepImprovement artifact={artifact} onSaved={refresh} />}
          {currentStep === 3 && <StepVerification refreshKey={refreshKey} />}
        </div>

        <ChatWindow aiOutput={aiOutput} step={currentStep} />
        <RegisterForm />
        <ProfileDrawer refreshKey={refreshKey} />
      </div>
    </aside>
  );
}
