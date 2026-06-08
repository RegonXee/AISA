import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { ocrImages } from '@/lib/baidu-ocr';
import { streamChat, type Message } from '@/lib/deepseek';
import { parseExcel, formatErrorRateData } from '@/lib/excel-parser';
import { EXAM_REVIEW_PROMPT } from '@/lib/prompts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function extractDocxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) throw new Error('docx 中没有 word/document.xml');

  const paragraphs: string[] = [];
  const paragraphRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let paragraphMatch;
  while ((paragraphMatch = paragraphRegex.exec(xml)) !== null) {
    const parts: string[] = [];
    const textRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let textMatch;
    while ((textMatch = textRegex.exec(paragraphMatch[0])) !== null) {
      parts.push(textMatch[1]);
    }
    const line = parts.join('');
    if (line.trim()) paragraphs.push(line);
  }

  return paragraphs.join('\n');
}

async function extractExamContent(examFile: File | null, examText: string, examImages: File[]) {
  const parts: string[] = [];

  if (examImages.length > 0) {
    const apiKey = process.env.BAIDU_OCR_API_KEY;
    const secretKey = process.env.BAIDU_OCR_SECRET_KEY;
    if (!apiKey || !secretKey) {
      throw new Error('百度 OCR 密钥未配置，请在 .env.local 中设置');
    }
    const buffers = await Promise.all(
      examImages.map(async (image) => Buffer.from(await image.arrayBuffer()))
    );
    const ocrText = await ocrImages(buffers, { apiKey, secretKey });
    if (ocrText.trim()) parts.push(ocrText);
  }

  if (examFile && examFile.size > 0) {
    const buffer = Buffer.from(await examFile.arrayBuffer());
    if (examFile.name.endsWith('.docx')) {
      parts.push(await extractDocxText(buffer));
    } else if (examFile.name.endsWith('.doc')) {
      const WordExtractor = (await import('word-extractor')).default;
      const extractor = new WordExtractor();
      const doc = await extractor.extract(buffer);
      parts.push(doc.getBody());
    } else {
      parts.push(await examFile.text());
    }
  }

  if (examText.trim()) parts.push(examText.trim());
  return parts.filter((part) => part.trim()).join('\n\n');
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const excelFile = formData.get('excel') as File | null;
    const examFile = formData.get('exam') as File | null;
    const examText = String(formData.get('examText') || '');
    const examImages = formData.getAll('examImages') as File[];

    if (!excelFile) {
      return NextResponse.json({ error: '请上传成绩 Excel 文件' }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'DeepSeek API 密钥未配置' }, { status: 500 });
    }

    const excelBuffer = Buffer.from(await excelFile.arrayBuffer());
    const errorRateData = parseExcel(excelBuffer);
    const formattedErrorRate = formatErrorRateData(errorRateData);
    const examContent = await extractExamContent(examFile, examText, examImages);

    if (!examContent.trim()) {
      return NextResponse.json({ error: '无法获取试卷内容，请上传试卷文件、图片或粘贴文本' }, { status: 400 });
    }

    const userContent = `## 学生答题数据
${formattedErrorRate}

## 试卷完整内容
${examContent}`;

    const messages: Message[] = [
      { role: 'system', content: EXAM_REVIEW_PROMPT },
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
      { error: error instanceof Error ? error.message : '试卷讲评生成失败' },
      { status: 500 }
    );
  }
}

