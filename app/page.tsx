import Link from 'next/link';

const FEATURES = [
  {
    href: '/lesson-design',
    title: '教学设计',
    description: '上传课本图片或输入课文内容，生成教案、任务单、分层写作指导和 PPT 框架。',
  },
  {
    href: '/essay-eval',
    title: '作文评价',
    description: '输入学生作文，生成形成性评价、逐句问题标注、修改示范和提升建议。',
  },
  {
    href: '/exam-review',
    title: '试卷讲评',
    description: '上传成绩 Excel 与试卷内容，生成基于小题分的诊断和讲评方案。',
  },
];

export default function HomePage() {
  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <section className="mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">AISA</h1>
        <p className="text-xl text-gray-300 mb-2">Your AI Smart Assistant</p>
        <p className="text-gray-400 max-w-3xl">
          面向初中英语教学的 AI 助手。三大主功能负责生成教学材料，进入任一功能页后，右侧 AISA 侧边栏会承接人机协同决策、改进闭环、教师画像和案例材料导出。
        </p>
      </section>

      <section className="grid md:grid-cols-3 gap-5">
        {FEATURES.map((feature) => (
          <Link
            key={feature.href}
            href={feature.href}
            className="bg-dark-card rounded-xl p-6 border border-dark-border hover:border-primary/60 transition-colors"
          >
            <h2 className="text-xl font-bold text-white mb-3">{feature.title}</h2>
            <p className="text-gray-400 leading-relaxed">{feature.description}</p>
            <div className="mt-6 text-primary font-semibold">进入功能</div>
          </Link>
        ))}
      </section>
    </div>
  );
}

