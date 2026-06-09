import { NextRequest, NextResponse } from 'next/server';
import { ocrImages } from '@/lib/baidu-ocr';
import { streamChat, type Message } from '@/lib/deepseek';
import { extractFileText } from '@/lib/document-extract';
import { LESSON_DESIGN_PROMPT } from '@/lib/prompts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const text = String(formData.get('text') || '');
    const grade = String(formData.get('grade') || '八年级');
    const period = String(formData.get('period') || '2课时');
    const demands = String(formData.get('demands') || '');
    const demandFile = formData.get('demandFile') as File | null;
    const images = formData.getAll('images') as File[];

    if (!text.trim() && images.length === 0) {
      return NextResponse.json({ error: '请提供课文内容或上传图片' }, { status: 400 });
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

    const combinedText = [text.trim(), ocrText.trim()].filter(Boolean).join('\n\n');
    const demandDocument = await extractFileText(demandFile);
    const demandContent = [
      demands.trim(),
      demandDocument?.text ? `来自诉求文档《${demandDocument.fileName}》：\n${demandDocument.text}` : '',
      ...(demandDocument?.warnings || []),
    ].filter(Boolean).join('\n\n');

    const userContent = `请为${grade}学生设计一份${period}的读写课教学方案。

## 课文内容
${combinedText}

## 教师诉求、问题与改进要求
${demandContent || '教师未提供额外诉求，请主要依据课文内容和学段要求生成。'}

请将教师诉求与课文本身结合，不要机械附加；若诉求与课文内容冲突，请优先说明取舍并给出可执行调整。`;

    const messages: Message[] = [
      { role: 'system', content: LESSON_DESIGN_PROMPT },
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
      { error: error instanceof Error ? error.message : '教学设计生成失败' },
      { status: 500 }
    );
  }
}
