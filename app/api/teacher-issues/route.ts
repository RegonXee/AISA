import { NextRequest, NextResponse } from 'next/server';
import { generateAviaReportMarkdownFromPdf } from '@/lib/avia-report-ocr';
import { ocrImages } from '@/lib/baidu-ocr';
import { chat, type Message } from '@/lib/deepseek';
import { compactTextForModel, extractFileText } from '@/lib/document-extract';
import { createTeacherIssueRecord, filterStoreByUser, readStore } from '@/lib/evidence-store';
import { TEACHER_ISSUE_PROMPT } from '@/lib/prompts';
import { requireUsername } from '@/lib/user-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parseScore(markdown: string) {
  const patterns = [
    /当前评分[：:\s]*(\d{1,3})/,
    /评分[：:\s]*(\d{1,3})\s*\/\s*100/,
    /(\d{1,3})\s*分/,
  ];
  for (const pattern of patterns) {
    const match = markdown.match(pattern);
    if (match) return clampScore(Number(match[1]));
  }
  return 70;
}

function parseJsonBlock(markdown: string) {
  const titledMatch = markdown.match(/画像评分JSON[\s\S]*?```json\s*([\s\S]*?)```/);
  const plainMatch = markdown.match(/```json\s*([\s\S]*?)```/);
  const rawJson = titledMatch?.[1] || plainMatch?.[1];
  if (!rawJson) return {};

  try {
    return JSON.parse(rawJson) as {
      profileScores?: Record<string, number>;
      overallScores?: Record<string, number>;
    };
  } catch {
    return {};
  }
}

function normalizeScores<T extends Record<string, number>>(value: unknown, keys: Array<keyof T>) {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  const output = {} as T;
  for (const key of keys) {
    const score = Number(record[String(key)]);
    if (!Number.isFinite(score)) return undefined;
    output[key] = clampScore(score) as T[keyof T];
  }
  return output;
}

function extractSection(markdown: string, sectionName: string) {
  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`##+\\s*[^\\n]*${escaped}[^\\n]*\\n([\\s\\S]*?)(?=\\n##+\\s|$)`));
  return match?.[1]?.trim() || '';
}

function hasUsefulManualEvidence(...values: string[]) {
  return values.some((value) => value.trim().length > 80);
}

function looksLikeGarbledPdfText(value: string) {
  if (!value.trim()) return false;
  const suspiciousChars = (value.match(/[ÿþýøÄÅÆÇÐÑØÜÝÞß�]/g) || []).length;
  const readableChars = (value.match(/[\u4e00-\u9fa5A-Za-z0-9，。；：！？、（）《》“”‘’%\s/.-]/g) || []).length;
  const totalChars = Math.max(value.length, 1);
  return suspiciousChars >= 3 || readableChars / totalChars < 0.55;
}

function buildFallbackMarkdown(input: {
  ownerUsername: string;
  teacherName: string;
  evidenceTitle: string;
  aviaData: string;
  transcript: string;
  previousMarkdown: string;
}) {
  return `# 教师存在的问题与改进

## 基本信息
- 教师：${input.teacherName || input.ownerUsername}
- 课例/证据名称：${input.evidenceTitle || '奥威亚课堂数据诊断'}
- 生成日期：${new Date().toLocaleDateString('zh-CN')}

## 数据可靠性检查
- 可用数据：已读取教师补充的奥威亚文字数据与课堂逐字稿。
- 忽略或谨慎使用的数据：若报告中的图表未能通过 OCR/视觉模型稳定转写，需谨慎使用；若出现板书率为 0 等明显异常值，应作为异常项忽略。

## 教师存在的问题
1. 证据组织仍需人工复核。当前输入文本长度：奥威亚数据 ${input.aviaData.length} 字，逐字稿 ${input.transcript.length} 字。
2. 若逐字稿中教师连续讲解过长、学生回应偏少，需要进一步压缩讲授并增加学生可观察产出。
3. 若奥威亚指标与逐字稿不一致，应优先以逐字稿和课堂实录事实为准。

## 改进建议
1. 下次上传时补充关键指标：师生话语占比、互动次数、板书/课件使用、学生展示次数、课堂节奏节点。
2. 将每个问题对应到一个课堂动作，例如减少整段讲解、增加同伴讨论、设置即时检测题。
3. 再次上传同类数据，让系统比较是否改进。

## 再评价打分
- 当前评分：65/100
- 是否改进：${input.previousMarkdown ? '需要结合上一次记录继续比较。' : '暂无前一次记录，先作为基线。'}

## 下一轮循环任务
下次课后继续上传奥威亚数据和逐字稿，重点验证互动质量、学生输出和目标达成情况。`;
}

export async function GET(request: NextRequest) {
  try {
    const ownerUsername = requireUsername(request);
    const store = filterStoreByUser(await readStore(), ownerUsername);
    return NextResponse.json({ records: store.teacherIssueRecords });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '读取教师诊断记录失败' },
      { status: 401 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ownerUsername = requireUsername(request);
    const formData = await request.formData();
    const apiKey = process.env.DEEPSEEK_API_KEY;
    const teacherName = String(formData.get('teacherName') || ownerUsername).trim();
    const evidenceTitle = String(formData.get('evidenceTitle') || '奥威亚课堂数据诊断').trim();
    const lessonText = String(formData.get('lessonText') || '').trim();
    const transcriptText = String(formData.get('transcriptText') || '').trim();
    const aviaDataText = String(formData.get('aviaDataText') || '').trim();
    const teacherDemands = String(formData.get('teacherDemands') || '').trim();
    const sourceArtifactId = String(formData.get('sourceArtifactId') || '').trim();
    const sourceArtifactTitle = String(formData.get('sourceArtifactTitle') || '').trim();
    const aviaImages = formData.getAll('aviaImages') as File[];

    const rawAviaFile = formData.get('aviaFile') as File | null;
    const rawAviaBuffer = rawAviaFile && rawAviaFile.size > 0
      ? Buffer.from(await rawAviaFile.arrayBuffer())
      : null;
    const aviaFile = await extractFileText(rawAviaFile);
    const transcriptFile = await extractFileText(formData.get('transcriptFile') as File | null);
    let aviaImageOcrText = '';
    let aviaReportMarkdown = '';
    const imageWarnings: string[] = [];

    const rawAviaFileName = rawAviaFile?.name.toLowerCase() || '';
    const rawAviaIsPdf = rawAviaFileName.endsWith('.pdf') || rawAviaFile?.type === 'application/pdf';
    if (rawAviaFile && rawAviaBuffer && rawAviaIsPdf) {
      try {
        const ocrResult = await generateAviaReportMarkdownFromPdf(rawAviaFile.name, rawAviaBuffer);
        aviaReportMarkdown = ocrResult.markdown;
        imageWarnings.push(
          `已用 PyMuPDF 按 ${ocrResult.metadata?.dpi || 200}dpi 渲染奥威亚 PDF，并用硅基流动视觉模型处理 ${ocrResult.metadata?.renderedPageCount || 0}/${ocrResult.metadata?.pageCount || 0} 页。`
        );
        imageWarnings.push(...ocrResult.warnings);
      } catch (error) {
        imageWarnings.push(`奥威亚 PDF 渲染/OCR/硅基流动视觉识别失败：${error instanceof Error ? error.message : '未知错误'}`);
      }
    }

    if (aviaImages.length > 0) {
      const baiduApiKey = process.env.BAIDU_OCR_API_KEY;
      const baiduSecretKey = process.env.BAIDU_OCR_SECRET_KEY;
      if (!baiduApiKey || !baiduSecretKey) {
        imageWarnings.push('已上传奥威亚图表截图，但百度 OCR 密钥未配置，截图文字未被识别。');
      } else {
        const imageBuffers = await Promise.all(
          aviaImages.map(async (image) => Buffer.from(await image.arrayBuffer()))
        );
        aviaImageOcrText = await ocrImages(imageBuffers, { apiKey: baiduApiKey, secretKey: baiduSecretKey });
      }
    }

    const manualEvidenceAvailable = hasUsefulManualEvidence(aviaDataText, transcriptText, transcriptFile?.text || '');
    const loosePdfTextUsable = Boolean(
      aviaFile?.text &&
      (!rawAviaIsPdf || !looksLikeGarbledPdfText(aviaFile.text))
    );

    const aviaData = [
      aviaReportMarkdown ? `奥威亚 PDF 经 PyMuPDF 渲染、百度 OCR 保底、硅基流动视觉模型结构识别后的 Markdown：\n${aviaReportMarkdown}` : '',
      loosePdfTextUsable && !aviaReportMarkdown ? `来自文件《${aviaFile?.fileName}》：\n${aviaFile?.text}` : '',
      rawAviaIsPdf && aviaFile?.text && !loosePdfTextUsable ? 'PDF 可提取文本疑似为二进制乱码，已忽略该部分，避免污染诊断。' : '',
      aviaImageOcrText ? `来自 ${aviaImages.length} 张奥威亚图表截图的 OCR 识别结果：\n${aviaImageOcrText}` : '',
      aviaDataText,
      ...(aviaFile?.warnings || []),
      ...imageWarnings,
    ].filter(Boolean).join('\n\n');
    const transcript = [
      transcriptFile?.text ? `来自文件《${transcriptFile.fileName}》：\n${transcriptFile.text}` : '',
      transcriptText,
      ...(transcriptFile?.warnings || []),
    ].filter(Boolean).join('\n\n');
    const compactLessonText = compactTextForModel(lessonText, 12000);
    const compactTeacherDemands = compactTextForModel(teacherDemands, 6000);
    const compactAviaData = compactTextForModel(aviaData, 60000);
    const compactTranscript = compactTextForModel(transcript, 22000);

    if (!aviaData.trim() && !transcript.trim()) {
      return NextResponse.json({ error: '请上传奥威亚数据、逐字稿，或粘贴关键数据文本' }, { status: 400 });
    }

    const store = filterStoreByUser(await readStore(), ownerUsername);
    const previousRecord = store.teacherIssueRecords[0];
    const previousMarkdown = compactTextForModel(previousRecord?.markdown || '', 8000);

    let markdown = '';
    if (!markdown && rawAviaIsPdf && !aviaReportMarkdown && !loosePdfTextUsable && !manualEvidenceAvailable && aviaImages.length === 0) {
      return NextResponse.json({
        error: [
          '已收到奥威亚 PDF，但 PyMuPDF 渲染/OCR/硅基流动视觉识别没有成功生成有效证据。为避免基于乱码或空证据生成无效报告，已停止。',
          '具体信息：',
          ...imageWarnings,
          '请检查服务器是否已安装 PyMuPDF：pip install pymupdf；并确认 SILICONFLOW_API_KEY、SILICONFLOW_VISION_MODEL 是否正确。',
        ].join('\n'),
        details: imageWarnings,
      }, { status: 400 });
    }

    if (apiKey) {
      const userContent = `## 教师
${teacherName || ownerUsername}

## 课例/证据名称
${evidenceTitle}

## 课文内容
${compactLessonText || '未提供课文内容。'}

## 教师诉求
${compactTeacherDemands || '未提供额外诉求。'}

## 奥威亚系统数据（已转 Markdown/文字）
${compactAviaData || '未提供。'}

## 课堂逐字稿
${compactTranscript || '未提供。'}

## 上一次教师问题与改进记录
${previousMarkdown || '暂无上一次记录，本次作为基线。'}`;

      const messages: Message[] = [
        { role: 'system', content: TEACHER_ISSUE_PROMPT },
        { role: 'user', content: userContent },
      ];
      markdown = await chat(messages, apiKey);
    } else {
      markdown = buildFallbackMarkdown({
        ownerUsername,
        teacherName,
        evidenceTitle,
        aviaData,
        transcript,
        previousMarkdown,
      });
    }

    const scoreBefore = parseScore(markdown);
    const scoreJson = parseJsonBlock(markdown);
    const aiProfileScores = normalizeScores<{
      classroomGuidance: number;
      questionQuality: number;
      studentLanguageOutput: number;
      activityPacing: number;
      feedbackAndCorrection: number;
      improvementContinuity: number;
    }>(scoreJson.profileScores, [
      'classroomGuidance',
      'questionQuality',
      'studentLanguageOutput',
      'activityPacing',
      'feedbackAndCorrection',
      'improvementContinuity',
    ]);
    const aiOverallScores = normalizeScores<{
      studentLearningOutput: number;
      interactionQuality: number;
      feedbackRegulation: number;
      improvementTrend: number;
      professionalAutonomy: number;
    }>(scoreJson.overallScores, [
      'studentLearningOutput',
      'interactionQuality',
      'feedbackRegulation',
      'improvementTrend',
      'professionalAutonomy',
    ]);
    const previousScore = previousRecord?.scoreBefore;
    const improved = previousScore === undefined ? undefined : scoreBefore > previousScore;
    const problemsMarkdown = extractSection(markdown, '教师存在的问题') || markdown.slice(0, 1200);
    const improvementMarkdown = extractSection(markdown, '改进建议') || extractSection(markdown, '下一轮循环任务');
    const ignoredDataNotes = [
      ...(aviaFile?.warnings || []),
      ...(transcriptFile?.warnings || []),
      ...(extractSection(markdown, '忽略或谨慎使用的数据') ? [extractSection(markdown, '忽略或谨慎使用的数据')] : []),
    ].filter(Boolean);
    const nextAction = extractSection(markdown, '下一轮循环任务') || '下次课后继续上传奥威亚数据和逐字稿，复盘是否改进。';

    const record = await createTeacherIssueRecord({
      ownerUsername,
      teacherName: teacherName || ownerUsername,
      sourceArtifactId: sourceArtifactId || undefined,
      sourceArtifactTitle: sourceArtifactTitle || undefined,
      evidenceTitle,
      lessonTranscript: transcript.slice(0, 20000),
      aviaDataSummary: aviaData.slice(0, 20000),
      ignoredDataNotes,
      problemsMarkdown,
      improvementMarkdown,
      markdown,
      aiProfileScores,
      aiOverallScores,
      scoreBefore,
      scoreAfter: previousScore === undefined ? undefined : scoreBefore,
      improved,
      nextAction,
    });

    return NextResponse.json({
      record,
      markdown,
      aviaEvidenceMarkdown: aviaReportMarkdown,
      evidenceMarkdown: aviaData,
      evidenceWarnings: imageWarnings,
    });
  } catch (error) {
    console.error('[teacher-issues] failed to generate teacher diagnosis', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '生成教师问题诊断失败' },
      { status: error instanceof Error && error.message.includes('登录') ? 401 : 500 }
    );
  }
}
