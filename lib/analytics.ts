import type { CollaborationLog, ImprovementTask, StoreData } from './evidence-store';

export interface TeacherProfileMetrics {
  instructionalDesign: number;
  dataAnalysis: number;
  reflectionDepth: number;
  improvementExecution: number;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, item) => sum + item, 0) / values.length;
}

function reflectionScore(logs: CollaborationLog[]) {
  return average(
    logs.map((log) => {
      const lengthScore = Math.min(log.reflection.length / 120, 1) * 55;
      const specificityWords = ['学生', '证据', '原因', '调整', '目标', '问题', '效果'];
      const specificityScore = specificityWords.filter((word) => log.reflection.includes(word)).length * 8;
      return clampScore(lengthScore + specificityScore);
    })
  );
}

function executionScore(tasks: ImprovementTask[]) {
  if (tasks.length === 0) return 0;
  const completed = tasks.filter((task) => task.status === 'completed').length;
  const withEvidence = tasks.filter((task) => task.evidence.length > 0).length;
  return clampScore((completed / tasks.length) * 70 + (withEvidence / tasks.length) * 30);
}

export function calculateTeacherProfile(data: StoreData): TeacherProfileMetrics {
  const lessonLogs = data.collaborationLogs.filter((log) => log.artifactKind === 'lesson-design');
  const dataLogs = data.collaborationLogs.filter((log) => log.artifactKind !== 'lesson-design');
  const modifiedLogs = data.collaborationLogs.filter((log) => log.modifiedParts.trim().length > 0);

  return {
    instructionalDesign: clampScore(lessonLogs.length * 18 + modifiedLogs.length * 8),
    dataAnalysis: clampScore(dataLogs.length * 16 + data.improvementTasks.length * 12),
    reflectionDepth: clampScore(reflectionScore(data.collaborationLogs)),
    improvementExecution: executionScore(data.improvementTasks),
  };
}

export function buildMonthlyTrend(data: StoreData) {
  const buckets = new Map<string, { logs: number; completedTasks: number; evidence: number }>();

  for (const log of data.collaborationLogs) {
    const key = log.createdAt.slice(0, 7);
    const bucket = buckets.get(key) ?? { logs: 0, completedTasks: 0, evidence: 0 };
    bucket.logs += 1;
    buckets.set(key, bucket);
  }

  for (const task of data.improvementTasks) {
    const key = task.createdAt.slice(0, 7);
    const bucket = buckets.get(key) ?? { logs: 0, completedTasks: 0, evidence: 0 };
    if (task.status === 'completed') bucket.completedTasks += 1;
    bucket.evidence += task.evidence.length;
    buckets.set(key, bucket);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => ({
      month,
      score: clampScore(value.logs * 12 + value.completedTasks * 30 + value.evidence * 10),
      ...value,
    }));
}

export function buildCaseReport(data: StoreData) {
  const metrics = calculateTeacherProfile(data);
  const latestLogs = data.collaborationLogs.slice(0, 5);
  const latestTasks = data.improvementTasks.slice(0, 5);

  const logLines = latestLogs.length
    ? latestLogs.map((log, index) => `${index + 1}. ${log.artifactTitle}: 教师决策为“${log.teacherDecision}”，反思为“${log.reflection}”。`).join('\n')
    : '暂无教师决策与反思日志。';

  const taskLines = latestTasks.length
    ? latestTasks.map((task, index) => {
      const latest = task.evidence.at(-1);
      const result = latest ? `最新证据为 ${latest.metricName}=${latest.metricValue}` : '尚未上传再证据';
      return `${index + 1}. 问题“${task.problem}”，行动“${task.actionPlan}”，${result}。`;
    }).join('\n')
    : '暂无改进闭环任务。';

  return `# 人机协同循证教研案例总结报告（草稿）

## 一、案例背景
本案例围绕初中英语教学中的教学设计、作文评价和试卷讲评三个真实场景，使用 AI 完成证据分析与初稿生成，再由教师完成采纳、修改、反思和再验证，形成“证据采集-AI 分析-教师决策-实施改进-效果追踪”的闭环。

## 二、实施过程
${logLines}

## 三、教师发展画像
- 教学设计能力：${metrics.instructionalDesign}
- 数据分析能力：${metrics.dataAnalysis}
- 反思深度：${metrics.reflectionDepth}
- 改进执行力：${metrics.improvementExecution}

## 四、成效评估
${taskLines}

## 五、人机协同机制
系统不直接替代教师判断，而是把 AI 建议、教师决策、修改理由和实施结果放在同一条证据链中。教师保留专业判断权，AI 负责提供结构化分析、生成建议和辅助材料整理。

## 六、AI 使用说明
本报告草稿由系统基于已保存的 AI 生成结果、教师反思日志和改进任务记录自动整理生成。教师需对事实、数据和表述进行最终审核。

## 七、后续改进
建议继续补充更多课堂实施证据、学生二次作品或单元测验数据，并在每次改进后记录目标达成情况。`;
}

