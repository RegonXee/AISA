import { NextRequest, NextResponse } from 'next/server';
import { streamChat, Message } from '@/lib/deepseek';
import { LESSON_DESIGN_PROMPT } from '@/lib/prompts';
import { ocrImages } from '@/lib/baidu-ocr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const text = (formData.get('text') as string) || '';
    const grade = formData.get('grade') as string;
    const period = formData.get('period') as string;
    const images = formData.getAll('images') as File[];

    if (!text.trim() && images.length === 0) {
      return NextResponse.json({ error: '请提供课文内容或上传图片' }, { status: 400 });
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
    const combinedText = [text.trim(), ocrText.trim()].filter(Boolean).join('\n\n');

    const userContent = `请为${grade}学生设计一份${period}的读写课教案。

## 课文内容：
${combinedText}

## 要求：
1. 生成四个配套文件：教案、学生任务单、分层写作指导、PPT课件框架
2. 教案中的教学内容段落要融入深度语篇解读
3. 写作环节要分层（L1基础/L2标准/L3拓展）
4. 严格按照提供的格式输出`;

    const messages: Message[] = [
      { role: 'system', content: LESSON_DESIGN_PROMPT },
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
    console.error('教案设计API错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器错误' },
      { status: 500 }
    );
  }
}
