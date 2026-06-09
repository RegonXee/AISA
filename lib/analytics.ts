import type { CollaborationLog, ImprovementTask, StoreData, TeacherIssueRecord } from './evidence-store';

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

function issueRecordScore(records: TeacherIssueRecord[]) {
  return average(records.map((record) => {
    const analysisDepth = Math.min(record.markdown.length / 1600, 1) * 45;
    const evidenceUse = ['数据', '逐字稿', '证据', '忽略', '改进', '再次'].filter((word) => record.markdown.includes(word)).length * 7;
    const improvementGain = record.improved === undefined || record.scoreAfter === undefined
      ? 0
      : Math.max(0, record.scoreAfter - record.scoreBefore) * 1.2;
    return clampScore(analysisDepth + evidenceUse + improvementGain);
  }));
}

export function calculateTeacherProfile(data: StoreData): TeacherProfileMetrics {
  const lessonLogs = data.collaborationLogs.filter((log) => log.artifactKind === 'lesson-design');
  const dataLogs = data.collaborationLogs.filter((log) => log.artifactKind !== 'lesson-design');
  const modifiedLogs = data.collaborationLogs.filter((log) => log.modifiedParts.trim().length > 0);
  const issueRecords = data.teacherIssueRecords;
  const verifiedRecords = issueRecords.filter((record) => record.improved !== undefined);

  return {
    instructionalDesign: clampScore(lessonLogs.length * 18 + modifiedLogs.length * 8 + issueRecords.length * 6),
    dataAnalysis: clampScore(dataLogs.length * 16 + data.improvementTasks.length * 12 + issueRecords.length * 18),
    reflectionDepth: clampScore(reflectionScore(data.collaborationLogs) + issueRecordScore(issueRecords) * 0.35),
    improvementExecution: clampScore(executionScore(data.improvementTasks) + verifiedRecords.length * 14),
  };
}

export function buildMonthlyTrend(data: StoreData) {
  const buckets = new Map<string, { logs: number; completedTasks: number; evidence: number; issueRecords: number; verified: number }>();

  for (const log of data.collaborationLogs) {
    const key = log.createdAt.slice(0, 7);
    const bucket = buckets.get(key) ?? { logs: 0, completedTasks: 0, evidence: 0, issueRecords: 0, verified: 0 };
    bucket.logs += 1;
    buckets.set(key, bucket);
  }

  for (const task of data.improvementTasks) {
    const key = task.createdAt.slice(0, 7);
    const bucket = buckets.get(key) ?? { logs: 0, completedTasks: 0, evidence: 0, issueRecords: 0, verified: 0 };
    if (task.status === 'completed') bucket.completedTasks += 1;
    bucket.evidence += task.evidence.length;
    buckets.set(key, bucket);
  }

  for (const record of data.teacherIssueRecords) {
    const key = record.createdAt.slice(0, 7);
    const bucket = buckets.get(key) ?? { logs: 0, completedTasks: 0, evidence: 0, issueRecords: 0, verified: 0 };
    bucket.issueRecords += 1;
    if (record.improved !== undefined) bucket.verified += 1;
    buckets.set(key, bucket);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => ({
      month,
      score: clampScore(value.logs * 12 + value.completedTasks * 30 + value.evidence * 10 + value.issueRecords * 20 + value.verified * 18),
      ...value,
    }));
}

export function buildTeacherIssueTimeline(data: StoreData) {
  return [...data.teacherIssueRecords]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((record) => ({
      id: record.id,
      date: record.createdAt,
      teacherName: record.teacherName,
      evidenceTitle: record.evidenceTitle,
      scoreBefore: record.scoreBefore,
      scoreAfter: record.scoreAfter,
      improved: record.improved,
      summary: record.problemsMarkdown.replace(/[#>*_`|~-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160),
      nextAction: record.nextAction,
    }));
}

export function buildCaseReport(data: StoreData) {
  const metrics = calculateTeacherProfile(data);
  const latestLogs = data.collaborationLogs.slice(0, 5);
  const latestTasks = data.improvementTasks.slice(0, 5);
  const latestIssues = data.teacherIssueRecords.slice(0, 5);

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

  const issueLines = latestIssues.length
    ? latestIssues.map((record, index) => {
      const verified = record.scoreAfter === undefined ? '尚未再次评分' : `再次评分 ${record.scoreAfter}，${record.improved ? '已显示改进' : '仍需继续改进'}`;
      return `${index + 1}. ${record.evidenceTitle}: 初次评分 ${record.scoreBefore}，${verified}。后续行动：${record.nextAction}`;
    }).join('\n')
    : '暂无奥威亚课堂诊断记录。';

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

## 五、奥威亚课堂诊断时间轴
${issueLines}

## 六、人机协同机制
系统不直接替代教师判断，而是把 AI 建议、教师决策、修改理由和实施结果放在同一条证据链中。教师保留专业判断权，AI 负责提供结构化分析、生成建议和辅助材料整理。

## 七、AI 使用说明
本报告草稿由系统基于已保存的 AI 生成结果、教师反思日志和改进任务记录自动整理生成。教师需对事实、数据和表述进行最终审核。

## 八、后续改进
建议继续补充更多课堂实施证据、学生二次作品或单元测验数据，并在每次改进后记录目标达成情况。`;
}
