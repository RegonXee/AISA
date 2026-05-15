import { NextRequest, NextResponse } from 'next/server';
import { streamChat, Message } from '@/lib/deepseek';
import { parseExcel, formatErrorRateData } from '@/lib/excel-parser';
import { EXAM_REVIEW_PROMPT } from '@/lib/prompts';
import { ocrImages } from '@/lib/baidu-ocr';
import JSZip from 'jszip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 用jszip直接解压docx提取文本（最可靠）
async function extractDocxText(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) throw new Error('docx中无word/document.xml');
  // 提取 <w:t> 标签文本，按段落 <w:p> 分组
  const paragraphs: string[] = [];
  const pRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let pMatch;
  while ((pMatch = pRegex.exec(xml)) !== null) {
    const pXml = pMatch[0];
    const parts: string[] = [];
    const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let tMatch;
    while ((tMatch = tRegex.exec(pXml)) !== null) {
      parts.push(tMatch[1]);
    }
    const line = parts.join('');
    if (line.trim()) paragraphs.push(line);
  }
  return paragraphs.join('\n');
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const excelFile = formData.get('excel') as File | null;
    const examFile = formData.get('exam') as File | null;
    const examText = formData.get('examText') as string | null;
    const examImageFiles = formData.getAll('examImages') as File[];

    if (!excelFile) {
      return NextResponse.json({ error: '请上传成绩Excel文件' }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API密钥未配置' }, { status: 500 });
    }

    // 解析Excel
    const excelBuffer = Buffer.from(await excelFile.arrayBuffer());
    const errorRateData = parseExcel(excelBuffer);
    const formattedErrorRate = formatErrorRateData(errorRateData);

    // 解析试卷
    let examContent = '';
    const debug: string[] = [];

    // 图片OCR
    if (examImageFiles.length > 0) {
      const ocrApiKey = process.env.BAIDU_OCR_API_KEY;
      const ocrSecretKey = process.env.BAIDU_OCR_SECRET_KEY;
      if (ocrApiKey && ocrSecretKey) {
        try {
          const bufs = await Promise.all(examImageFiles.map(async f => Buffer.from(await f.arrayBuffer())));
          const txt = await ocrImages(bufs, { apiKey: ocrApiKey, secretKey: ocrSecretKey });
          if (txt.trim()) { examContent += txt; debug.push(`OCR: ${examImageFiles.length}张, ${txt.length}字`); }
          else { debug.push('OCR返回空'); }
        } catch (e) { debug.push(`OCR失败: ${e instanceof Error ? e.message : '未知'}`); }
      } else { debug.push('OCR密钥未配置'); }
    }

    // 文件解析
    if (examFile) {
      debug.push(`文件:${examFile.name} ${examFile.size}B`);
      if (examFile.size > 0) {
        const buf = Buffer.from(await examFile.arrayBuffer());
        debug.push(`buf:${buf.length}B`);

        if (examFile.name.endsWith('.docx')) {
          try {
            const text = await extractDocxText(buf);
            if (text.trim()) {
              examContent += (examContent ? '\n\n' : '') + text;
              debug.push(`docx解析成功: ${text.length}字`);
            } else { debug.push('docx解析结果为空'); }
          } catch (e) { debug.push(`docx解析失败: ${e instanceof Error ? e.message : '未知'}`); }
        } else if (examFile.name.endsWith('.doc')) {
          try {
            const WordExtractor = (await import('word-extractor')).default;
            const ext = new WordExtractor();
            const doc = await ext.extract(buf);
            const body = doc.getBody();
            if (body && body.trim()) {
              examContent += (examContent ? '\n\n' : '') + body;
              debug.push(`.doc解析成功: ${body.length}字`);
            } else { debug.push('.doc返回空'); }
          } catch (e) { debug.push(`.doc失败: ${e instanceof Error ? e.message : '未知'}`); }
        } else if (examFile.name.endsWith('.txt')) {
          examContent += await examFile.text();
          debug.push('txt读取成功');
        } else {
          // 其他格式尝试当文本读
          try { examContent += await examFile.text(); debug.push('文本读取成功'); }
          catch (e) { debug.push(`未知格式读取失败: ${e instanceof Error ? e.message : '未知'}`); }
        }
      } else { debug.push('文件大小为0'); }
    }

    // 手动文本
    if (examText && examText.trim()) {
      examContent += (examContent ? '\n\n' : '') + examText.trim();
      debug.push('手动文本已添加');
    }

    console.log('试卷调试:', debug.join(' | '));

    if (!examContent.trim()) {
      return NextResponse.json({ error: `无法获取试卷内容。调试: ${debug.join('；')}` }, { status: 400 });
    }

    const userMessage = `## 学生答题数据
${formattedErrorRate}

## 试卷完整内容
${examContent}

请根据以上数据生成试卷评讲方案。`;

    const messages: Message[] = [
      { role: 'system', content: EXAM_REVIEW_PROMPT },
      { role: 'user', content: userMessage },
    ];

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await streamChat(messages, apiKey, {
            onChunk: (chunk) => { controller.enqueue(encoder.encode(chunk)); },
            onComplete: () => { controller.close(); },
            onError: (error) => { controller.error(error); },
          });
        } catch (error) { controller.error(error); }
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Transfer-Encoding': 'chunked' },
    });
  } catch (error) {
    console.error('试卷评讲API错误:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : '服务器错误' }, { status: 500 });
  }
}
