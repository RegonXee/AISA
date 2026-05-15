import Link from 'next/link';

const FEATURES = [
  {
    href: '/lesson-design',
    icon: '📚',
    title: '教案设计',
    description: '基于语篇深度解读，生成完整的读写课教学设计，包含教案、学生任务单、分层写作指导、PPT框架',
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-500/10',
  },
  {
    href: '/essay-eval',
    icon: '✍️',
    title: '作文评价',
    description: '基于中考评分标准，对学生作文进行精准评价，给出分层、可操作的改进建议',
    color: 'from-purple-500 to-pink-500',
    bgColor: 'bg-purple-500/10',
  },
  {
    href: '/exam-review',
    icon: '📝',
    title: '试卷评讲',
    description: '上传成绩Excel和试卷，自动分析错误率，生成按优先级排序的评讲方案',
    color: 'from-green-500 to-emerald-500',
    bgColor: 'bg-green-500/10',
  },
];

export default function HomePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          初中英语教学<span className="text-primary">AI</span>助手
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          基于DeepSeek大模型，为英语教师提供三大核心功能：教案设计、作文评价、试卷评讲
        </p>
      </div>

      {/* Features Grid */}
      <div className="grid md:grid-cols-3 gap-6 mb-16">
        {FEATURES.map((feature) => (
          <Link
            key={feature.href}
            href={feature.href}
            className="group relative bg-dark-card rounded-2xl p-8 border border-dark-border hover:border-transparent transition-all duration-300 overflow-hidden"
          >
            {/* 背景渐变 */}
            <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
            
            <div className="relative">
              {/* Icon */}
              <div className={`w-16 h-16 ${feature.bgColor} rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform duration-300`}>
                {feature.icon}
              </div>
              
              {/* Title */}
              <h2 className="text-2xl font-bold text-white mb-3 group-hover:text-primary transition-colors">
                {feature.title}
              </h2>
              
              {/* Description */}
              <p className="text-gray-400 leading-relaxed mb-6">
                {feature.description}
              </p>
              
              {/* Button */}
              <div className="flex items-center text-primary font-medium">
                <span>开始使用</span>
                <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Feature Highlights */}
      <div className="bg-dark-card rounded-2xl p-8 border border-dark-border">
        <h2 className="text-2xl font-bold text-white mb-8 text-center">核心能力</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 bg-primary/20 rounded-xl flex items-center justify-center">
              <span className="text-2xl">🎯</span>
            </div>
            <h3 className="font-semibold text-white mb-2">精准评价</h3>
            <p className="text-gray-400 text-sm">基于中考评分标准，评价精准可靠</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 bg-secondary/20 rounded-xl flex items-center justify-center">
              <span className="text-2xl">📊</span>
            </div>
            <h3 className="font-semibold text-white mb-2">数据驱动</h3>
            <p className="text-gray-400 text-sm">基于错误率分析，优先讲解高频错题</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <span className="text-2xl">📋</span>
            </div>
            <h3 className="font-semibold text-white mb-2">完整产出</h3>
            <p className="text-gray-400 text-sm">四个配套文件，拿来就能上课</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 bg-orange-500/20 rounded-xl flex items-center justify-center">
              <span className="text-2xl">⚡</span>
            </div>
            <h3 className="font-semibold text-white mb-2">即时生成</h3>
            <p className="text-gray-400 text-sm">流式输出，快速获得AI建议</p>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="mt-16 text-center">
        <h2 className="text-2xl font-bold text-white mb-8">使用流程</h2>
        <div className="flex flex-wrap justify-center gap-8">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-bold">1</div>
            <span className="text-gray-300">输入内容</span>
          </div>
          <div className="text-gray-600">→</div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-bold">2</div>
            <span className="text-gray-300">AI分析</span>
          </div>
          <div className="text-gray-600">→</div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-bold">3</div>
            <span className="text-gray-300">获取方案</span>
          </div>
          <div className="text-gray-600">→</div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center text-white font-bold">✓</div>
            <span className="text-gray-300">应用到课堂</span>
          </div>
        </div>
      </div>
    </div>
  );
}
