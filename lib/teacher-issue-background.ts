import { promises as fs } from 'fs';
import { chat, type Message } from '@/lib/deepseek';
import { generateAviaReportMarkdownFromPdf } from '@/lib/avia-report-ocr';
import { ocrImages } from '@/lib/baidu-ocr';
import { compactTextForModel } from '@/lib/document-extract';
import {
  createTeacherIssueRecord,
  filterStoreByUser,
  getTeacherIssueJob,
  readStore,
  type TeacherIssueJobPayload,
  updateTeacherIssueJob,
  upsertPageMemory,
} from '@/lib/evidence-store';
import { TEACHER_ISSUE_PROMPT } from '@/lib/prompts';

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parseScore(markdown: string) {
  const patterns = [
    /当前评分[:\s]*(\d{1,3})/,
    /评分[:\s]*(\d{1,3})\s*\/\s*100/,
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

## 证据判断
- 可用数据：已读取教师补充的奥威亚文本数据与课堂逐字稿。
- 需要谨慎使用的数据：若报告中的图表未能通过 OCR/视觉模型稳定转写，则仅作为辅助，不作为唯一依据。

## 教师存在的问题
1. 证据组织仍需人工复核。当前输入长度：奥威亚数据 ${input.aviaData.length} 字，逐字稿 ${input.transcript.length} 字。
2. 若逐字稿中教师连续讲解过长、学生回应偏少，需要进一步压缩讲授并增加学生可观察产出。
3. 若奥威亚指标与逐字稿不一致，应优先以逐字稿和课堂事实为准。

## 改进建议
1. 下次上传时补充关键指标：师生话语占比、互动次数、板书使用、学生展示次数、课堂节奏节点。
2. 将每个问题对应到一个可执行课堂动作，例如缩短讲解、增加同伴讨论、设计即时检测。
3. 再次上传同类数据，系统会结合前次记录继续比较是否有改进。

## 再评价打分
- 当前评分：5/100
- 是否改进：${input.previousMarkdown ? '需要结合上一轮记录继续比较。' : '暂无上一轮记录，先作为基线。'}

## 下一轮任务
继续上传奥威亚数据和逐字稿，重点验证互动质量、学生输出和目标达成情况。`;
}

async function readOptionalFile(filePath?: string) {
  if (!filePath) return null;
  try {
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

function buildPromptInput(payload: TeacherIssueJobPayload) {
  return `## 教师
${payload.teacherName || '未填写'}

## 课例/证据名称
${payload.evidenceTitle || '奥威亚课堂数据诊断'}

## 课文内容
${payload.lessonText || '未提供'}

## 教师诉求
${payload.teacherDemands || '未提供'}

## 奥威亚系统数据
${payload.aviaDataText || '未提供'}

## 课堂逐字稿
${payload.transcriptText || '未提供'}

## 上一轮教师问题与改进记录
${payload.previousMarkdown || '暂无'}
`;
}

function buildMemoryInput(payload: TeacherIssueJobPayload, evidenceMarkdown: string) {
  return {
    teacherName: payload.teacherName,
    evidenceTitle: payload.evidenceTitle,
    lessonText: payload.lessonText,
    teacherDemands: payload.teacherDemands,
    aviaDataText: payload.aviaDataText,
    transcriptText: payload.transcriptText,
    sourceArtifactId: payload.sourceArtifactId || '',
    sourceArtifactTitle: payload.sourceArtifactTitle || '',
    evidenceMarkdown,
    imageCount: payload.imageCount || 0,
  };
}

function getDiagnosisEvidenceMaxChars() {
  return Math.max(8000, Number(process.env.AVIA_DIAGNOSIS_EVIDENCE_CHARS || 28000));
}

function getEvidenceChunkChars() {
  return Math.max(8000, Number(process.env.AVIA_EVIDENCE_CHUNK_CHARS || 16000));
}

function splitTextBySize(value: string, maxChars: number) {
  const chunks: string[] = [];
  for (let index = 0; index < value.length; index += maxChars) {
    chunks.push(value.slice(index, index + maxChars));
  }
  return chunks;
}

async function buildDiagnosisEvidence(evidenceMarkdown: string, apiKey: string) {
  const maxChars = getDiagnosisEvidenceMaxChars();
  if (!apiKey || evidenceMarkdown.length <= maxChars) {
    return compactTextForModel(evidenceMarkdown, maxChars);
  }

  const chunkSize = getEvidenceChunkChars();
  const chunks = splitTextBySize(evidenceMarkdown, chunkSize);
  const summaries: string[] = [];

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index] || '';
    try {
      const summary = await chat([
        {
          role: 'system',
          content: [
            '你是英语课堂教学诊断助手。',
            '你的任务不是生成最终评价，而是从奥威亚 OCR Markdown 分块中提取可用于诊断的证据。',
            '必须保留页码、指标名称、数值、异常数据、课堂行为、问题列表、建议列表和可疑 OCR 点。',
            '不要扩写，不要臆测，不要评价教师人格，只整理证据。',
          ].join('\n'),
        },
        {
          role: 'user',
          content: `这是奥威亚 OCR Markdown 的第 ${index + 1}/${chunks.length} 个分块。请输出结构化 Markdown 证据摘要。\n\n${chunk}`,
        },
      ], apiKey);
      summaries.push(`## 证据分块 ${index + 1}/${chunks.length}\n\n${summary}`);
    } catch (error) {
      summaries.push([
        `## 证据分块 ${index + 1}/${chunks.length}`,
        '',
        `> 本分块摘要 API 失败，已保留压缩原文。错误：${error instanceof Error ? error.message : '未知错误'}`,
        '',
        compactTextForModel(chunk, 6000),
      ].join('\n'));
    }
  }

  return compactTextForModel([
    '# 奥威亚诊断证据包',
    '',
    `- 原始拼接 Markdown 字符数：${evidenceMarkdown.length}`,
    `- 分块数量：${chunks.length}`,
    '',
    summaries.join('\n\n---\n\n'),
  ].join('\n'), maxChars);
}

export async function processTeacherIssueJob(ownerUsername: string, jobId: string, options: { force?: boolean } = {}) {
  const existingJob = await getTeacherIssueJob(ownerUsername, jobId);
  if (!existingJob || (existingJob.status !== 'pending' && !(options.force && existingJob.status === 'running'))) {
    return existingJob;
  }

  const startedAt = new Date().toISOString();
  await updateTeacherIssueJob(jobId, ownerUsername, {
    status: 'running',
    stage: options.force ? 'restarting-stale-job' : 'preparing',
    startedAt,
  });

  try {
    const payload = existingJob.payload;
    const apiKey = process.env.DEEPSEEK_API_KEY;
    const aviaReportBuffer = await readOptionalFile(payload.aviaFilePath);
    const imageBuffers = await Promise.all((payload.imagePaths || []).map((item) => readOptionalFile(item)));
    const validImageBuffers = imageBuffers.filter((item): item is NonNullable<typeof item> => item !== null);

    let aviaReportMarkdown = '';
    const imageWarnings: string[] = [];

    if (aviaReportBuffer && payload.aviaFileName?.toLowerCase().endsWith('.pdf')) {
      try {
        await updateTeacherIssueJob(jobId, ownerUsername, { stage: 'recognizing-pages' });
        const ocrResult = await generateAviaReportMarkdownFromPdf(payload.aviaFileName, aviaReportBuffer, {
          onProgress: (progress) => updateTeacherIssueJob(jobId, ownerUsername, {
            stage: `recognizing-pages:${progress.completedPages}/${progress.totalPages}`,
          }).then(() => undefined),
        });
        aviaReportMarkdown = ocrResult.markdown;
        imageWarnings.push(...ocrResult.warnings);
      } catch (error) {
        imageWarnings.push(`奥威亚 PDF 解析失败：${error instanceof Error ? error.message : '未知错误'}`);
      }
    }

    if (validImageBuffers.length > 0) {
      const baiduApiKey = process.env.BAIDU_OCR_API_KEY;
      const baiduSecretKey = process.env.BAIDU_OCR_SECRET_KEY;
      if (baiduApiKey && baiduSecretKey) {
        try {
          const text = await ocrImages(validImageBuffers, { apiKey: baiduApiKey, secretKey: baiduSecretKey });
          if (text.trim()) {
            imageWarnings.push(`已识别 ${validImageBuffers.length} 张奥威亚截图。`);
          }
          payload.aviaDataText = [payload.aviaDataText, text].filter(Boolean).join('\n\n');
        } catch (error) {
          imageWarnings.push(`奥威亚截图 OCR 失败：${error instanceof Error ? error.message : '未知错误'}`);
        }
      } else {
        imageWarnings.push('已上传奥威亚截图，但百度 OCR 未配置，截图文字未被识别。');
      }
    }

    const store = filterStoreByUser(await readStore(), ownerUsername);
    const previousRecord = store.teacherIssueRecords[0];
    const previousMarkdown = compactTextForModel(payload.previousMarkdown || previousRecord?.markdown || '', 8000);
    const aviaFileText = compactTextForModel(payload.aviaFileText || '', 20000);
    const transcriptFileText = compactTextForModel(payload.transcriptFileText || '', 20000);
    const compactLessonText = compactTextForModel(payload.lessonText, 12000);
    const compactTeacherDemands = compactTextForModel(payload.teacherDemands, 6000);
    const compactAviaData = compactTextForModel(
      [
        aviaReportMarkdown ? `奥威亚 PDF 结构化结果：\n${aviaReportMarkdown}` : '',
        payload.aviaDataText,
        aviaFileText,
        ...imageWarnings,
      ].filter(Boolean).join('\n\n'),
      60000
    );
    const compactTranscript = compactTextForModel([payload.transcriptText, transcriptFileText].filter(Boolean).join('\n\n'), 22000);
    const evidenceMarkdown = aviaReportMarkdown || compactAviaData;
    await updateTeacherIssueJob(jobId, ownerUsername, { stage: 'summarizing-evidence' });
    const diagnosisAviaData = await buildDiagnosisEvidence(evidenceMarkdown, apiKey || '');

    let markdown = '';
    if (apiKey) {
      await updateTeacherIssueJob(jobId, ownerUsername, { stage: 'generating-diagnosis' });
      const userContent = buildPromptInput({
        ...payload,
        aviaDataText: diagnosisAviaData,
        transcriptText: compactTranscript,
        lessonText: compactLessonText,
        teacherDemands: compactTeacherDemands,
        previousMarkdown,
      });

      const messages: Message[] = [
        { role: 'system', content: TEACHER_ISSUE_PROMPT },
        { role: 'user', content: userContent },
      ];
      markdown = await chat(messages, apiKey);
    } else {
      markdown = buildFallbackMarkdown({
        ownerUsername,
        teacherName: payload.teacherName,
        evidenceTitle: payload.evidenceTitle,
        aviaData: diagnosisAviaData,
        transcript: compactTranscript,
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
    const problemsMarkdown = extractSection(markdown, '教师存在的问题') || markdown.slice(0, 1200);
    const improvementMarkdown = extractSection(markdown, '改进建议') || extractSection(markdown, '下一轮任务');
    const ignoredDataNotes = imageWarnings;
    const nextAction = extractSection(markdown, '下一轮任务') || '继续上传同类数据，验证改进是否有效。';

    const record = await createTeacherIssueRecord({
      ownerUsername,
      teacherName: payload.teacherName || ownerUsername,
      sourceArtifactId: payload.sourceArtifactId || undefined,
      sourceArtifactTitle: payload.sourceArtifactTitle || undefined,
      evidenceTitle: payload.evidenceTitle,
      lessonTranscript: compactTranscript.slice(0, 20000),
      aviaDataSummary: compactAviaData.slice(0, 20000),
      ignoredDataNotes,
      problemsMarkdown,
      improvementMarkdown,
      markdown,
      aiProfileScores,
      aiOverallScores,
      scoreBefore,
      scoreAfter: undefined,
      improved: undefined,
      nextAction,
    });

    await upsertPageMemory({
      ownerUsername,
      pageKey: 'teacher-issues',
      input: buildMemoryInput(payload, evidenceMarkdown),
      output: markdown,
    });

    const finishedAt = new Date().toISOString();
    await updateTeacherIssueJob(jobId, ownerUsername, {
      status: 'completed',
      stage: 'completed',
      recordId: record.id,
      resultMarkdown: markdown,
      evidenceMarkdown,
      finishedAt,
    });

    return await getTeacherIssueJob(ownerUsername, jobId);
  } catch (error) {
    const message = error instanceof Error ? error.message : '教师诊断生成失败';
    await updateTeacherIssueJob(jobId, ownerUsername, {
      status: 'failed',
      stage: 'failed',
      error: message,
      finishedAt: new Date().toISOString(),
    }).catch(() => undefined);
    return await getTeacherIssueJob(ownerUsername, jobId);
  }
}
