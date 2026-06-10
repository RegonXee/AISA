import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { ocrImage } from './baidu-ocr';
import {
  analyzeAviaPageWithSiliconFlow,
  getSiliconFlowVisionConfig,
  hasSiliconFlowVisionConfig,
} from './siliconflow-vision';

const execFileAsync = promisify(execFile);

interface RenderedPage {
  page: number;
  path: string;
  width: number;
  height: number;
}

interface RenderMetadata {
  pageCount: number;
  renderedPageCount: number;
  dpi: number;
  pdfMetadata?: Record<string, string>;
  extractedTextChars: number;
  isLikelyImagePdf: boolean;
  pages: RenderedPage[];
}

export interface AviaReportMarkdownResult {
  markdown: string;
  warnings: string[];
  metadata?: RenderMetadata;
}

export interface AviaReportMarkdownProgress {
  completedPages: number;
  totalPages: number;
  currentPage: number;
}

export interface AviaReportMarkdownOptions {
  onProgress?: (progress: AviaReportMarkdownProgress) => void | Promise<void>;
}

function getPythonCommand() {
  return process.env.PYTHON_BIN || process.env.PYTHON || 'python';
}

function getRenderDpi() {
  return Math.max(120, Number(process.env.AVIA_PDF_RENDER_DPI || 200));
}

function getMaxPages() {
  return Math.max(0, Number(process.env.AVIA_PDF_MAX_PAGES || 0));
}

function getOcrConcurrency() {
  const raw = Number(process.env.AVIA_OCR_CONCURRENCY || process.env.SILICONFLOW_VISION_CONCURRENCY || 5);
  return Math.max(1, Math.min(8, Math.floor(raw)));
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(limit, items.length);

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index];
      if (item === undefined) continue;
      results[index] = await worker(item, index);
    }
  }));

  return results;
}

async function renderPdfPages(pdfBuffer: Buffer): Promise<{ tempDir: string; metadata: RenderMetadata }> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aisa-avia-pages-'));
  const pdfPath = path.join(tempDir, 'report.pdf');
  const outputDir = path.join(tempDir, 'pages');
  await fs.writeFile(pdfPath, pdfBuffer);

  const scriptPath = path.join(process.cwd(), 'scripts', 'render_pdf_pages.py');
  const { stdout } = await execFileAsync(
    getPythonCommand(),
    [
      scriptPath,
      '--input',
      pdfPath,
      '--output-dir',
      outputDir,
      '--dpi',
      String(getRenderDpi()),
      '--max-pages',
      String(getMaxPages()),
    ],
    { maxBuffer: 1024 * 1024 * 10 }
  );

  const metadata = JSON.parse(stdout.trim()) as RenderMetadata;
  return { tempDir, metadata };
}

function buildCombinedMarkdown(input: {
  fileName: string;
  metadata: RenderMetadata;
  pages: Array<{ page: number; markdown: string; warning?: string }>;
}) {
  const pagesMarkdown = input.pages
    .map((page) => [
      `---`,
      `## 第${page.page}页`,
      page.markdown || '本页未返回有效识别内容。',
      page.warning ? `> 本页处理提示：${page.warning}` : '',
    ].filter(Boolean).join('\n\n'))
    .join('\n\n');

  return `# 奥威亚 AI课堂基础分析报告 OCR Markdown

- 文件：${input.fileName}
- PDF 页数：${input.metadata.pageCount}
- 已渲染页数：${input.metadata.renderedPageCount}
- 渲染 DPI：${input.metadata.dpi}
- PDF 生成器：${input.metadata.pdfMetadata?.producer || input.metadata.pdfMetadata?.creator || '未识别'}
- 可提取文本字符数：${input.metadata.extractedTextChars}
- PDF 类型判断：${input.metadata.isLikelyImagePdf ? '疑似纯图片 PDF' : '存在可提取文本或混合内容'}

${pagesMarkdown}`;
}

export async function generateAviaReportMarkdownFromPdf(
  fileName: string,
  pdfBuffer: Buffer,
  options: AviaReportMarkdownOptions = {}
): Promise<AviaReportMarkdownResult> {
  const warnings: string[] = [];
  if (!hasSiliconFlowVisionConfig()) {
    throw new Error('未配置 SILICONFLOW_API_KEY，无法使用硅基流动视觉模型识别奥威亚 PDF。');
  }

  const baiduApiKey = process.env.BAIDU_OCR_API_KEY || '';
  const baiduSecretKey = process.env.BAIDU_OCR_SECRET_KEY || '';
  const hasBaiduOcr = Boolean(baiduApiKey && baiduSecretKey);
  if (!hasBaiduOcr) {
    warnings.push('未配置百度 OCR，页面将只由硅基流动视觉模型识别；建议配置百度 OCR 作为第一遍文字保底。');
  }

  let tempDir = '';
  try {
    console.info(`[avia-report-ocr] render start: ${fileName}, bytes=${pdfBuffer.length}, dpi=${getRenderDpi()}, maxPages=${getMaxPages() || 'all'}`);
    const rendered = await renderPdfPages(pdfBuffer);
    tempDir = rendered.tempDir;
    const { metadata } = rendered;
    console.info(`[avia-report-ocr] render done: ${fileName}, rendered=${metadata.renderedPageCount}/${metadata.pageCount}, extractedTextChars=${metadata.extractedTextChars}`);
    const siliconFlowConfig = getSiliconFlowVisionConfig();
    const concurrency = getOcrConcurrency();

    if (metadata.isLikelyImagePdf) {
      warnings.push(`PDF 检测：该文件共 ${metadata.pageCount} 页，可提取文本仅 ${metadata.extractedTextChars} 字，按图片型 PDF 处理。`);
    }

    console.info(`[avia-report-ocr] page analysis start: rendered=${metadata.pages.length}, concurrency=${concurrency}`);

    let completedPages = 0;
    const pages = await runWithConcurrency(metadata.pages, concurrency, async (page) => {
      console.info(`[avia-report-ocr] page ${page.page}/${metadata.pageCount} start`);
      const imageBuffer = await fs.readFile(page.path);
      let baiduOcrText = '';
      let warning = '';

      if (hasBaiduOcr) {
        try {
          baiduOcrText = await ocrImage(imageBuffer, { apiKey: baiduApiKey, secretKey: baiduSecretKey });
        } catch (error) {
          warning = `百度 OCR 失败：${error instanceof Error ? error.message : '未知错误'}`;
        }
      }

      try {
        const markdown = await analyzeAviaPageWithSiliconFlow({
          pageNumber: page.page,
          totalPages: metadata.pageCount,
          imageBuffer,
          baiduOcrText,
        }, siliconFlowConfig);
        console.info(`[avia-report-ocr] page ${page.page}/${metadata.pageCount} done, markdownChars=${markdown.length}`);
        const result = { page: page.page, markdown, warning };
        completedPages += 1;
        await options.onProgress?.({
          completedPages,
          totalPages: metadata.pages.length,
          currentPage: page.page,
        });
        return result;
      } catch (error) {
        console.warn(`[avia-report-ocr] page ${page.page}/${metadata.pageCount} vision failed`, error);
        const result = {
          page: page.page,
          markdown: baiduOcrText
            ? `### 第${page.page}页\n\n${baiduOcrText}\n\n#### 本页校验说明\n- 硅基流动视觉识别失败，仅保留百度 OCR 结果。\n- 不可靠或看不清内容：本页缺少版面结构与表格还原。`
            : '',
          warning: `硅基流动视觉识别失败：${error instanceof Error ? error.message : '未知错误'}`,
        };
        completedPages += 1;
        await options.onProgress?.({
          completedPages,
          totalPages: metadata.pages.length,
          currentPage: page.page,
        });
        return result;
      }
    });
    pages.sort((a, b) => a.page - b.page);

    const markdown = buildCombinedMarkdown({ fileName, metadata, pages });
    return {
      markdown,
      warnings: [
        ...warnings,
        ...pages.map((page) => page.warning).filter((item): item is string => Boolean(item)),
      ],
      metadata,
    };
  } finally {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
