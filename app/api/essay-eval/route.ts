import { NextRequest, NextResponse } from 'next/server';
import { ocrImages } from '@/lib/baidu-ocr';
import { streamChat, type Message } from '@/lib/deepseek';
import { ESSAY_EVAL_PROMPT } from '@/lib/prompts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const topic = String(formData.get('topic') || '');
    const essay = String(formData.get('essay') || '');
    const grade = String(formData.get('grade') || '九年级');
    const images = formData.getAll('images') as File[];

    if (!topic.trim() && images.length === 0) {
      return NextResponse.json({ error: '请提供作文题目或上传图片' }, { status: 400 });
    }
    if (!essay.trim() && images.length === 0) {
      return NextResponse.json({ error: '请提供学生作文或上传图片' }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'DeepSeek API 密钥未配置' }, { status: 500 });
    }

    let ocrText = '';
    if (images.length > 0) {
      const baiduApiKey = process.env.BAIDU_OCR_API_KEY;
      const baiduSecretKey = process.env.BAIDU_OCR_SECRET_KEY;
      if (!baiduApiKey || !baiduSecretKey) {
        return NextResponse.json({ error: '百度 OCR 密钥未配置，请在 .env.local 中设置' }, { status: 500 });
      }

      const imageBuffers = await Promise.all(
        images.map(async (image) => Buffer.from(await image.arrayBuffer()))
      );
      ocrText = await ocrImages(imageBuffers, { apiKey: baiduApiKey, secretKey: baiduSecretKey });
    }

    const combinedEssay = [essay.trim(), ocrText.trim()].filter(Boolean).join('\n\n');
    const userContent = `请评价以下学生作文。

## 作文题目
${topic}

## 年级
${grade}

## 学生作文
${combinedEssay}`;

    const messages: Message[] = [
      { role: 'system', content: ESSAY_EVAL_PROMPT },
      { role: 'user', content: userContent },
    ];

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        await streamChat(messages, apiKey, {
          onChunk: (chunk) => controller.enqueue(encoder.encode(chunk)),
          onComplete: () => controller.close(),
          onError: (error) => controller.error(error),
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '作文评价生成失败' },
      { status: 500 }
    );
  }
}

