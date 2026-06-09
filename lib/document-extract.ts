import JSZip from 'jszip';

export interface ExtractedDocument {
  fileName: string;
  text: string;
  warnings: string[];
}

const MAX_EXTRACTED_FILE_CHARS = 30000;

export function compactTextForModel(value: string, maxLength = MAX_EXTRACTED_FILE_CHARS) {
  const cleaned = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[^\S\r\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (cleaned.length <= maxLength) return cleaned;
  const headLength = Math.floor(maxLength * 0.7);
  const tailLength = maxLength - headLength;
  return `${cleaned.slice(0, headLength)}

……中间内容过长，已省略 ${cleaned.length - maxLength} 字……

${cleaned.slice(-tailLength)}`;
}

function decodeXmlText(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export async function extractDocxText(buffer: Buffer): Promise<string> {
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
      parts.push(decodeXmlText(textMatch[1]));
    }
    const line = parts.join('');
    if (line.trim()) paragraphs.push(line);
  }

  return paragraphs.join('\n');
}

function extractPdfTextLoosely(buffer: Buffer) {
  const raw = buffer.toString('latin1');
  const literalStrings = Array.from(raw.matchAll(/\(([^()]{2,})\)/g))
    .map((match) => match[1])
    .filter((value) => /[\w\u00a0-\uffff]/.test(value))
    .filter((value) => {
      const visibleChars = value.replace(/[^\x20-\x7E\u00a0-\uffff]/g, '');
      return visibleChars.length / Math.max(value.length, 1) > 0.65;
    })
    .slice(0, 800);

  const cleaned = literalStrings
    .map((value) => value.replace(/\\[rn]/g, '\n').replace(/\\([()\\])/g, '$1'))
    .join('\n')
    .replace(/[^\S\r\n]+/g, ' ')
    .trim();

  return cleaned.length > 80 ? compactTextForModel(cleaned, 12000) : '';
}

export async function extractFileText(file: File | null): Promise<ExtractedDocument | null> {
  if (!file || file.size === 0) return null;

  const fileName = file.name;
  const lowerName = fileName.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());
  const warnings: string[] = [];
  let text = '';

  if (lowerName.endsWith('.docx')) {
    text = await extractDocxText(buffer);
  } else if (lowerName.endsWith('.doc')) {
    const WordExtractor = (await import('word-extractor')).default;
    const extractor = new WordExtractor();
    const doc = await extractor.extract(buffer);
    text = doc.getBody();
  } else if (lowerName.endsWith('.pdf')) {
    text = extractPdfTextLoosely(buffer);
    warnings.push(
      'PDF 已接收。若该奥威亚报告主要由图表或截图组成，系统会尝试用 PyMuPDF 按 200dpi 渲染页面，并通过硅基流动视觉模型逐页转成结构化 Markdown。'
    );
  } else {
    text = await file.text();
  }

  const compacted = compactTextForModel(text);
  if (text.length > compacted.length) {
    warnings.push(`文件《${fileName}》内容较长，已压缩截取后送入模型。`);
  }

  return { fileName, text: compacted, warnings };
}

export async function extractFilesText(files: File[]) {
  const documents = await Promise.all(files.map((file) => extractFileText(file)));
  return documents.filter((item): item is ExtractedDocument => Boolean(item));
}
