import { NextRequest, NextResponse } from 'next/server';
import { chat, type Message } from '@/lib/deepseek';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STEP_ROLES = [
  '你是教学分析助手，请基于主页面 AI 输出提炼关键建议，并提醒教师哪些内容需要人工判断。',
  '你是教师决策教练，请帮助教师比较 AI 建议与真实学情，形成采纳、修改或拒绝的理由。',
  '你是教学改进规划助手，请把诊断结果转化为可执行行动、时间安排和再证据采集计划。',
  '你是循证验证助手，请帮助教师解释前后对比数据，并形成是否达成目标的反思。',
];

export async function POST(request: NextRequest) {
  try {
    const { messages = [], aiOutput = '', step = 0 } = await request.json();
    const apiKey = process.env.DEEPSEEK_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'DeepSeek API 密钥未配置' }, { status: 500 });
    }

    const prompt = `${STEP_ROLES[step] || STEP_ROLES[0]}

要求：
1. 回答要短，优先给可操作建议。
2. 明确标注这是“AI生成”建议，最终由教师判断。
3. 不编造主页面没有的事实。

主页面AI输出：
${String(aiOutput).slice(0, 6000) || '暂无主页面输出。'}`;

    const modelMessages: Message[] = [
      { role: 'system', content: prompt },
      ...messages.slice(-8).map((message: { role: 'user' | 'assistant'; content: string }) => ({
        role: message.role,
        content: message.content,
      })),
    ];

    const content = await chat(modelMessages, apiKey);
    return NextResponse.json({ content });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '侧边栏对话失败' },
      { status: 500 }
    );
  }
}

