import { NextRequest, NextResponse } from 'next/server';
import { streamChat, Message } from '@/lib/deepseek';
import { ESSAY_EVAL_PROMPT } from '@/lib/prompts';
import { ocrImages } from '@/lib/baidu-ocr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const topic = (formData.get('topic') as string) || '';
    const essay = (formData.get('essay') as string) || '';
    const grade = formData.get('grade') as string;
    const images = formData.getAll('images') as File[];

    if (!topic.trim() && !essay.trim() && images.length === 0) {
      return NextResponse.json({ error: '请提供作文题目、学生作文或上传图片' }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'DeepSeek API密钥未配置' }, { status: 500 });
    }

    // 处理图片：用百度OCR提取文字
    let ocrText = '';
    if (images.length > 0) {
      const baiduApiKey = process.env.BAIDU_OCR_API_KEY;
      const baiduSecretKey = process.env.BAIDU_OCR_SECRET_KEY;
      
      if (!baiduApiKey || !baiduSecretKey) {
        return NextResponse.json({ error: '百度OCR密钥未配置，请在.env.local中设置BAIDU_OCR_API_KEY和BAIDU_OCR_SECRET_KEY' }, { status: 500 });
      }
      
      try {
        const imageBuffers = await Promise.all(
          images.map(async (img) => Buffer.from(await img.arrayBuffer()))
        );
        ocrText = await ocrImages(imageBuffers, { apiKey: baiduApiKey, secretKey: baiduSecretKey });
      } catch (ocrError) {
        console.error('OCR识别失败:', ocrError);
        return NextResponse.json({ 
          error: `图片识别失败: ${ocrError instanceof Error ? ocrError.message : '未知错误'}，请尝试直接粘贴文字内容` 
        }, { status: 500 });
      }
    }

    // 合并文本输入和OCR结果
    const combinedTopic = topic.trim();
    const combinedEssay = [essay.trim(), ocrText.trim()].filter(Boolean).join('\n\n');

    const userContent = `请评价以下学生作文：

## 作文题目/要求：
${combinedTopic}

## 学生作文（${grade || '九年级'}）：
${combinedEssay}

## 评价要求：
1. 进行定性评价（不打分）
2. 逐句标注问题
3. 给出具体可操作的改进建议
4. 提供修改示范`;

    const messages: Message[] = [
      { role: 'system', content: ESSAY_EVAL_PROMPT },
      { role: 'user', content: userContent },
    ];

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await streamChat(
            messages,
            apiKey,
            {
              onChunk: (chunk) => {
                controller.enqueue(encoder.encode(chunk));
              },
              onComplete: () => {
                controller.close();
              },
              onError: (error) => {
                controller.error(error);
              },
            }
          );
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    console.error('作文评价API错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器错误' },
      { status: 500 }
    );
  }
}
