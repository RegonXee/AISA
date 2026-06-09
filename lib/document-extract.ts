import JSZip from 'jszip';

export interface ExtractedDocument {
  fileName: string;
  text: string;
  warnings: string[];
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
    .filter((value) => /[\w\u00a0-\uffff]/.test(value));

  const cleaned = literalStrings
    .map((value) => value.replace(/\\[rn]/g, '\n').replace(/\\([()\\])/g, '$1'))
    .join('\n')
    .replace(/[^\S\r\n]+/g, ' ')
    .trim();

  return cleaned.length > 80 ? cleaned : '';
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
      'PDF 已接收。若该奥威亚报告主要由图表或截图组成，请同步上传关键图表截图，或粘贴视觉模型/人工读图后的指标描述；DeepSeek 只会分析已转成文字的数据。'
    );
  } else {
    text = await file.text();
  }

  return { fileName, text: text.trim(), warnings };
}

export async function extractFilesText(files: File[]) {
  const documents = await Promise.all(files.map((file) => extractFileText(file)));
  return documents.filter((item): item is ExtractedDocument => Boolean(item));
}
