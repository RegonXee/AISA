'use client';

import { useEffect, useState } from 'react';
import ChatWindow from './ChatWindow';
import ProfileDrawer from './ProfileDrawer';
import RegisterForm from './RegisterForm';
import StepAviaDiagnosis from './StepAviaDiagnosis';
import StepIndicator from './StepIndicator';

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
  const [currentStep, setCurrentStep] = useState(0);
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
          <p className="text-xs text-gray-500">课例与诉求 → 奥威亚诊断改进 → 教师画像时间轴</p>
        </div>
        <button onClick={() => setCollapsed(true)} className="rounded-lg border border-dark-border px-2 py-1 text-xs text-gray-400">
          折叠
        </button>
      </div>

      <div className="space-y-4">
        <StepIndicator currentStep={currentStep} onChange={setCurrentStep} />

        <div className="rounded-xl border border-dark-border bg-dark-card p-4">
          {currentStep === 0 && (
            <section className="space-y-3">
              <div>
                <h3 className="text-base font-semibold text-white">步骤1：课例输入与教师诉求</h3>
                <p className="mt-1 text-xs text-gray-500">主工作区录入课文、上传课文图片和诉求文档，生成结合教师诉求的教案。</p>
              </div>
              <div className="rounded-lg border border-dark-border bg-dark-bg p-3 text-xs text-gray-400">
                当前成果：{artifact ? <span className="text-primary">{artifact.title}</span> : '生成并保存教案后，会自动关联到后续奥威亚诊断。'}
              </div>
            </section>
          )}
          {currentStep === 1 && <StepAviaDiagnosis aiOutput={aiOutput} artifact={artifact} onSaved={refresh} />}
          {currentStep === 2 && <ProfileDrawer refreshKey={refreshKey} defaultOpen />}
        </div>

        <ChatWindow aiOutput={aiOutput} step={currentStep} />
        <RegisterForm />
      </div>
    </aside>
  );
}
