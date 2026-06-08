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

export interface StoreData {
  artifacts: Artifact[];
  collaborationLogs: CollaborationLog[];
  improvementTasks: ImprovementTask[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'evidence-store.json');

const EMPTY_STORE: StoreData = {
  artifacts: [],
  collaborationLogs: [],
  improvementTasks: [],
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
  };
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

