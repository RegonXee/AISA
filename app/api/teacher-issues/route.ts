import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { compactTextForModel, extractFileText } from '@/lib/document-extract';
import {
  createTeacherIssueJob,
  filterStoreByUser,
  getTeacherIssueJob,
  readStore,
  type TeacherIssueJob,
  type TeacherIssueJobPayload,
} from '@/lib/evidence-store';
import { processTeacherIssueJob } from '@/lib/teacher-issue-background';
import { requireUsername } from '@/lib/user-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80) || 'upload';
}

async function saveUploadFile(baseDir: string, file: File) {
  await fs.mkdir(baseDir, { recursive: true });
  const fileName = `${Date.now()}_${safeFileName(file.name || 'file')}`;
  const filePath = path.join(baseDir, fileName);
  await fs.writeFile(filePath, Buffer.from(await file.arrayBuffer()));
  return filePath;
}

function getStaleJobMs() {
  return Math.max(60_000, Number(process.env.AVIA_JOB_STALE_MS || 10 * 60 * 1000));
}

function isRestartableJob(job: TeacherIssueJob) {
  if (job.status !== 'running' && job.status !== 'pending') return false;
  const updatedAt = new Date(job.updatedAt).getTime();
  return Number.isFinite(updatedAt) && Date.now() - updatedAt > getStaleJobMs();
}

function resumeStaleJob(ownerUsername: string, job: TeacherIssueJob) {
  if (!isRestartableJob(job)) return;
  void processTeacherIssueJob(ownerUsername, job.id, { force: true }).catch((error) => {
    console.error('[teacher-issues] failed to resume stale background job', error);
  });
}

export async function GET(request: NextRequest) {
  try {
    const ownerUsername = requireUsername(request);
    const jobId = request.nextUrl.searchParams.get('jobId');

    if (jobId) {
      const job = await getTeacherIssueJob(ownerUsername, jobId);
      if (!job) {
        return NextResponse.json({ error: '未找到教师诊断任务' }, { status: 404 });
      }
      resumeStaleJob(ownerUsername, job);
      return NextResponse.json({ job });
    }

    const store = filterStoreByUser(await readStore(), ownerUsername);
    const latestJob = store.teacherIssueJobs[0];
    if (latestJob) resumeStaleJob(ownerUsername, latestJob);
    return NextResponse.json({
      records: store.teacherIssueRecords,
      jobs: store.teacherIssueJobs,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '读取教师诊断记录失败' },
      { status: error instanceof Error && error.message.includes('登录') ? 401 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ownerUsername = requireUsername(request);
    const formData = await request.formData();

    const teacherName = String(formData.get('teacherName') || ownerUsername).trim();
    const evidenceTitle = String(formData.get('evidenceTitle') || '奥威亚课堂数据诊断').trim();
    const lessonText = String(formData.get('lessonText') || '').trim();
    const transcriptText = String(formData.get('transcriptText') || '').trim();
    const aviaDataText = String(formData.get('aviaDataText') || '').trim();
    const teacherDemands = String(formData.get('teacherDemands') || '').trim();
    const sourceArtifactId = String(formData.get('sourceArtifactId') || '').trim();
    const sourceArtifactTitle = String(formData.get('sourceArtifactTitle') || '').trim();

    const rawAviaFile = formData.get('aviaFile') as File | null;
    const transcriptFile = formData.get('transcriptFile') as File | null;
    const aviaImages = formData.getAll('aviaImages').filter((item): item is File => item instanceof File);

    if (!rawAviaFile && !transcriptFile && aviaImages.length === 0 && !aviaDataText && !transcriptText) {
      return NextResponse.json(
        { error: '请上传奥威亚 PDF、截图，或粘贴奥威亚数据与逐字稿' },
        { status: 400 }
      );
    }

    const aviaFile = await extractFileText(rawAviaFile);
    const transcriptExtracted = await extractFileText(transcriptFile);
    const uploadToken = randomUUID();
    const uploadDir = path.join(process.cwd(), 'data', 'teacher-issue-uploads', uploadToken);

    let aviaFilePath = '';
    let imagePaths: string[] = [];
    if (rawAviaFile) {
      aviaFilePath = await saveUploadFile(uploadDir, rawAviaFile);
    }
    if (aviaImages.length > 0) {
      imagePaths = [];
      for (const image of aviaImages) {
        imagePaths.push(await saveUploadFile(uploadDir, image));
      }
    }
    if (transcriptFile) {
      await saveUploadFile(uploadDir, transcriptFile);
    }

    const store = filterStoreByUser(await readStore(), ownerUsername);
    const previousRecord = store.teacherIssueRecords[0];
    const previousMarkdown = compactTextForModel(previousRecord?.markdown || '', 8000);

    const payload: TeacherIssueJobPayload = {
      teacherName,
      evidenceTitle,
      lessonText,
      teacherDemands,
      aviaDataText,
      transcriptText,
      sourceArtifactId: sourceArtifactId || undefined,
      sourceArtifactTitle: sourceArtifactTitle || undefined,
      aviaFilePath: aviaFilePath || undefined,
      aviaFileName: rawAviaFile?.name || undefined,
      transcriptFileText: transcriptExtracted?.text || '',
      transcriptFileName: transcriptFile?.name || undefined,
      aviaFileText: aviaFile?.text || '',
      aviaFileWarnings: aviaFile?.warnings || [],
      transcriptFileWarnings: transcriptExtracted?.warnings || [],
      imageCount: imagePaths.length,
      imagePaths,
      previousMarkdown,
    };

    const job = await createTeacherIssueJob({
      ownerUsername,
      status: 'pending',
      stage: 'queued',
      payload,
    });

    void processTeacherIssueJob(ownerUsername, job.id).catch((error) => {
      console.error('[teacher-issues] background job failed to start', error);
    });

    return NextResponse.json(
      {
        job,
        message: '已提交后台识别任务，完成后会自动写入教师记忆。',
      },
      { status: 202 }
    );
  } catch (error) {
    console.error('[teacher-issues] failed to queue teacher diagnosis', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '提交教师诊断任务失败' },
      { status: error instanceof Error && error.message.includes('登录') ? 401 : 500 }
    );
  }
}
