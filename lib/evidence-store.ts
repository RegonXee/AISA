import { promises as fs } from 'fs';
import path from 'path';

export type ArtifactKind = 'lesson-design' | 'essay-eval' | 'exam-review';
export type TaskStatus = 'planned' | 'in-progress' | 'completed';

export interface Artifact {
  id: string;
  ownerUsername: string;
  kind: ArtifactKind;
  title: string;
  inputSummary: string;
  content: string;
  createdAt: string;
}

export interface CollaborationLog {
  id: string;
  ownerUsername: string;
  artifactId: string;
  artifactKind: ArtifactKind;
  artifactTitle: string;
  aiSuggestionSummary: string;
  teacherDecision: string;
  adoptedParts: string;
  modifiedParts: string;
  reflection: string;
  createdAt: string;
}

export interface EvidencePoint {
  id: string;
  collectedAt: string;
  label: string;
  metricName: string;
  metricValue: number;
  note: string;
}

export interface ImprovementTask {
  id: string;
  ownerUsername: string;
  sourceArtifactId?: string;
  sourceArtifactKind?: ArtifactKind;
  problem: string;
  actionPlan: string;
  nextEvidenceDate: string;
  targetMetric: string;
  targetValue: number;
  status: TaskStatus;
  achieved?: boolean;
  evidence: EvidencePoint[];
  createdAt: string;
  updatedAt: string;
}

export interface TeacherIssueRecord {
  id: string;
  ownerUsername: string;
  teacherName: string;
  sourceArtifactId?: string;
  sourceArtifactTitle?: string;
  evidenceTitle: string;
  lessonTranscript: string;
  aviaDataSummary: string;
  ignoredDataNotes: string[];
  problemsMarkdown: string;
  improvementMarkdown: string;
  markdown: string;
  aiProfileScores?: {
    classroomGuidance: number;
    questionQuality: number;
    studentLanguageOutput: number;
    activityPacing: number;
    feedbackAndCorrection: number;
    improvementContinuity: number;
  };
  aiOverallScores?: {
    studentLearningOutput: number;
    interactionQuality: number;
    feedbackRegulation: number;
    improvementTrend: number;
    professionalAutonomy: number;
  };
  scoreBefore: number;
  scoreAfter?: number;
  improved?: boolean;
  nextAction: string;
  createdAt: string;
  updatedAt: string;
}

export interface PageMemory {
  id: string;
  ownerUsername: string;
  pageKey: ArtifactKind | 'sidebar-chat' | 'teacher-issues';
  input: Record<string, unknown>;
  output: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherIssueJobPayload {
  teacherName: string;
  evidenceTitle: string;
  lessonText: string;
  teacherDemands: string;
  aviaDataText: string;
  transcriptText: string;
  sourceArtifactId?: string;
  sourceArtifactTitle?: string;
  aviaFilePath?: string;
  aviaFileName?: string;
  transcriptFileText?: string;
  transcriptFileName?: string;
  aviaFileText?: string;
  aviaFileWarnings?: string[];
  transcriptFileWarnings?: string[];
  imageCount?: number;
  imagePaths?: string[];
  imageWarnings?: string[];
  previousMarkdown?: string;
}

export type TeacherIssueJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface TeacherIssueJob {
  id: string;
  ownerUsername: string;
  status: TeacherIssueJobStatus;
  stage: string;
  payload: TeacherIssueJobPayload;
  recordId?: string;
  resultMarkdown?: string;
  evidenceMarkdown?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface StoreData {
  artifacts: Artifact[];
  collaborationLogs: CollaborationLog[];
  improvementTasks: ImprovementTask[];
  teacherIssueRecords: TeacherIssueRecord[];
  teacherIssueJobs: TeacherIssueJob[];
  pageMemories: PageMemory[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'evidence-store.json');

const EMPTY_STORE: StoreData = {
  artifacts: [],
  collaborationLogs: [],
  improvementTasks: [],
  teacherIssueRecords: [],
  teacherIssueJobs: [],
  pageMemories: [],
};

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, JSON.stringify(EMPTY_STORE, null, 2), 'utf8');
  }
}

export async function readStore(): Promise<StoreData> {
  await ensureStore();
  const raw = await fs.readFile(STORE_PATH, 'utf8');
  const parsed = JSON.parse(raw) as Partial<StoreData>;
  return {
    artifacts: parsed.artifacts ?? [],
    collaborationLogs: parsed.collaborationLogs ?? [],
    improvementTasks: parsed.improvementTasks ?? [],
    teacherIssueRecords: parsed.teacherIssueRecords ?? [],
    teacherIssueJobs: parsed.teacherIssueJobs ?? [],
    pageMemories: parsed.pageMemories ?? [],
  };
}

async function writeStore(data: StoreData) {
  await ensureStore();
  await fs.writeFile(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

export function filterStoreByUser(data: StoreData, ownerUsername: string): StoreData {
  return {
    artifacts: data.artifacts.filter((item) => item.ownerUsername === ownerUsername),
    collaborationLogs: data.collaborationLogs.filter((item) => item.ownerUsername === ownerUsername),
    improvementTasks: data.improvementTasks.filter((item) => item.ownerUsername === ownerUsername),
    teacherIssueRecords: data.teacherIssueRecords.filter((item) => item.ownerUsername === ownerUsername),
    teacherIssueJobs: data.teacherIssueJobs.filter((item) => item.ownerUsername === ownerUsername),
    pageMemories: data.pageMemories.filter((item) => item.ownerUsername === ownerUsername),
  };
}

export async function clearStoreByUser(ownerUsername: string) {
  const store = await readStore();
  const removed = {
    artifacts: store.artifacts.filter((item) => item.ownerUsername === ownerUsername).length,
    collaborationLogs: store.collaborationLogs.filter((item) => item.ownerUsername === ownerUsername).length,
    improvementTasks: store.improvementTasks.filter((item) => item.ownerUsername === ownerUsername).length,
    teacherIssueRecords: store.teacherIssueRecords.filter((item) => item.ownerUsername === ownerUsername).length,
    teacherIssueJobs: store.teacherIssueJobs.filter((item) => item.ownerUsername === ownerUsername).length,
    pageMemories: store.pageMemories.filter((item) => item.ownerUsername === ownerUsername).length,
  };

  store.artifacts = store.artifacts.filter((item) => item.ownerUsername !== ownerUsername);
  store.collaborationLogs = store.collaborationLogs.filter((item) => item.ownerUsername !== ownerUsername);
  store.improvementTasks = store.improvementTasks.filter((item) => item.ownerUsername !== ownerUsername);
  store.teacherIssueRecords = store.teacherIssueRecords.filter((item) => item.ownerUsername !== ownerUsername);
  store.teacherIssueJobs = store.teacherIssueJobs.filter((item) => item.ownerUsername !== ownerUsername);
  store.pageMemories = store.pageMemories.filter((item) => item.ownerUsername !== ownerUsername);
  await writeStore(store);
  return removed;
}

export async function getPageMemory(ownerUsername: string, pageKey: PageMemory['pageKey']) {
  const store = await readStore();
  return store.pageMemories.find((item) => item.ownerUsername === ownerUsername && item.pageKey === pageKey) || null;
}

export async function upsertPageMemory(input: Omit<PageMemory, 'id' | 'createdAt' | 'updatedAt'>) {
  const store = await readStore();
  const existing = store.pageMemories.find(
    (item) => item.ownerUsername === input.ownerUsername && item.pageKey === input.pageKey
  );
  const now = new Date().toISOString();

  if (existing) {
    existing.input = input.input;
    existing.output = input.output;
    existing.updatedAt = now;
    await writeStore(store);
    return existing;
  }

  const memory: PageMemory = {
    ...input,
    id: makeId('page_memory'),
    createdAt: now,
    updatedAt: now,
  };
  store.pageMemories.unshift(memory);
  await writeStore(store);
  return memory;
}

export async function createTeacherIssueJob(input: Omit<TeacherIssueJob, 'id' | 'createdAt' | 'updatedAt'>) {
  const store = await readStore();
  const job: TeacherIssueJob = {
    ...input,
    id: makeId('teacher_issue_job'),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.teacherIssueJobs.unshift(job);
  await writeStore(store);
  return job;
}

export async function getTeacherIssueJob(ownerUsername: string, jobId: string) {
  const store = await readStore();
  return store.teacherIssueJobs.find((item) => item.ownerUsername === ownerUsername && item.id === jobId) || null;
}

export async function updateTeacherIssueJob(
  jobId: string,
  ownerUsername: string,
  changes: Partial<
    Pick<
      TeacherIssueJob,
      'status' | 'stage' | 'recordId' | 'resultMarkdown' | 'evidenceMarkdown' | 'error' | 'startedAt' | 'finishedAt'
    >
  >
) {
  const store = await readStore();
  const job = store.teacherIssueJobs.find((item) => item.id === jobId && item.ownerUsername === ownerUsername);
  if (!job) throw new Error('未找到教师诊断任务');
  Object.assign(job, changes, { updatedAt: new Date().toISOString() });
  await writeStore(store);
  return job;
}

export async function createArtifact(input: Omit<Artifact, 'id' | 'createdAt'>) {
  const store = await readStore();
  const artifact: Artifact = {
    ...input,
    id: makeId('artifact'),
    createdAt: new Date().toISOString(),
  };
  store.artifacts.unshift(artifact);
  await writeStore(store);
  return artifact;
}

export async function createCollaborationLog(
  input: Omit<CollaborationLog, 'id' | 'createdAt'>
) {
  const store = await readStore();
  const log: CollaborationLog = {
    ...input,
    id: makeId('log'),
    createdAt: new Date().toISOString(),
  };
  store.collaborationLogs.unshift(log);
  await writeStore(store);
  return log;
}

export async function createImprovementTask(
  input: Omit<ImprovementTask, 'id' | 'status' | 'evidence' | 'createdAt' | 'updatedAt'>
) {
  const store = await readStore();
  const task: ImprovementTask = {
    ...input,
    id: makeId('task'),
    status: 'planned',
    evidence: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.improvementTasks.unshift(task);
  await writeStore(store);
  return task;
}

export async function addEvidencePoint(
  taskId: string,
  ownerUsername: string,
  evidence: Omit<EvidencePoint, 'id' | 'collectedAt'>
) {
  const store = await readStore();
  const task = store.improvementTasks.find(
    (item) => item.id === taskId && item.ownerUsername === ownerUsername
  );
  if (!task) throw new Error('未找到改进任务');

  const point: EvidencePoint = {
    ...evidence,
    id: makeId('evidence'),
    collectedAt: new Date().toISOString(),
  };

  task.evidence.push(point);
  task.status = task.evidence.length >= 2 ? 'completed' : 'in-progress';
  task.achieved = task.evidence.length >= 2
    ? task.evidence[task.evidence.length - 1].metricValue >= task.targetValue
    : undefined;
  task.updatedAt = new Date().toISOString();

  await writeStore(store);
  return task;
}

export async function createTeacherIssueRecord(
  input: Omit<TeacherIssueRecord, 'id' | 'createdAt' | 'updatedAt'>
) {
  const store = await readStore();
  const record: TeacherIssueRecord = {
    ...input,
    id: makeId('teacher_issue'),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.teacherIssueRecords.unshift(record);
  await writeStore(store);
  return record;
}

export async function updateTaskStatus(
  taskId: string,
  ownerUsername: string,
  status: TaskStatus,
  achieved?: boolean
) {
  const store = await readStore();
  const task = store.improvementTasks.find(
    (item) => item.id === taskId && item.ownerUsername === ownerUsername
  );
  if (!task) throw new Error('未找到改进任务');
  task.status = status;
  task.achieved = achieved;
  task.updatedAt = new Date().toISOString();
  await writeStore(store);
  return task;
}

export function summarizeMarkdown(content: string, maxLength = 220) {
  const plain = content
    .replace(/[#>*_`|~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > maxLength ? `${plain.slice(0, maxLength)}...` : plain;
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}
