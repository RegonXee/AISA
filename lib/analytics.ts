import type { CollaborationLog, ImprovementTask, StoreData, TeacherIssueRecord } from './evidence-store';

export interface TeacherProfileMetrics {
  classroomGuidance: number;
  questionQuality: number;
  studentLanguageOutput: number;
  activityPacing: number;
  feedbackAndCorrection: number;
  improvementContinuity: number;
}

export interface OverallEvaluation {
  score: number;
  dimensions: Array<{
    key: string;
    label: string;
    score: number;
    description: string;
  }>;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, item) => sum + item, 0) / values.length;
}

type ProfileScoreKey = keyof NonNullable<TeacherIssueRecord['aiProfileScores']>;
type OverallScoreKey = keyof NonNullable<TeacherIssueRecord['aiOverallScores']>;

function averageAiProfileScore(records: TeacherIssueRecord[], key: ProfileScoreKey) {
  const values = records
    .map((record) => record.aiProfileScores?.[key])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return values.length > 0 ? clampScore(average(values)) : undefined;
}

function averageAiOverallScore(records: TeacherIssueRecord[], key: OverallScoreKey) {
  const values = records
    .map((record) => record.aiOverallScores?.[key])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return values.length > 0 ? clampScore(average(values)) : undefined;
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

function keywordDimensionScore(records: TeacherIssueRecord[], keywords: string[]) {
  if (records.length === 0) return 0;
  return average(records.map((record) => {
    const text = `${record.problemsMarkdown}\n${record.improvementMarkdown}\n${record.markdown}`;
    const keywordHits = keywords.filter((word) => text.includes(word)).length;
    const evidenceDepth = Math.min(text.length / 2600, 1) * 25;
    return clampScore(record.scoreBefore * 0.55 + keywordHits * 8 + evidenceDepth);
  }));
}

function professionalAutonomyScore(logs: CollaborationLog[]) {
  if (logs.length === 0) return 0;
  return average(logs.map((log) => {
    const text = `${log.modifiedParts}\n${log.reflection}\n${log.teacherDecision}`;
    const autonomyWords = ['修改', '调整', '取舍', '原因', '学生', '实际', '课堂', '生成', '补充'];
    const hitScore = autonomyWords.filter((word) => text.includes(word)).length * 9;
    const lengthScore = Math.min(text.length / 220, 1) * 35;
    return clampScore(hitScore + lengthScore);
  }));
}

export function calculateTeacherProfile(data: StoreData): TeacherProfileMetrics {
  const issueRecords = data.teacherIssueRecords;
  const verifiedRecords = issueRecords.filter((record) => record.improved !== undefined);

  return {
    classroomGuidance: averageAiProfileScore(issueRecords, 'classroomGuidance')
      ?? keywordDimensionScore(issueRecords, ['师生互动', '生生互动', '学生参与', '讲授', '小组', '讨论', '互动']),
    questionQuality: averageAiProfileScore(issueRecords, 'questionQuality')
      ?? keywordDimensionScore(issueRecords, ['提问', '追问', '问题设计', '开放', '推理', '迁移', '思考']),
    studentLanguageOutput: averageAiProfileScore(issueRecords, 'studentLanguageOutput')
      ?? keywordDimensionScore(issueRecords, ['学生输出', '语言输出', '口语', '表达', '展示', '回答', '产出', '英语']),
    activityPacing: averageAiProfileScore(issueRecords, 'activityPacing')
      ?? keywordDimensionScore(issueRecords, ['活动', '节奏', '时间', '任务', '导入', '听前', '听中', '听后', '转换']),
    feedbackAndCorrection: averageAiProfileScore(issueRecords, 'feedbackAndCorrection')
      ?? keywordDimensionScore(issueRecords, ['反馈', '纠错', '评价', '追问', '支架', '点拨', '回应']),
    improvementContinuity: averageAiProfileScore(issueRecords, 'improvementContinuity')
      ?? clampScore(
      issueRecordScore(issueRecords) * 0.45 +
      executionScore(data.improvementTasks) * 0.35 +
      verifiedRecords.length * 10 +
      reflectionScore(data.collaborationLogs) * 0.2
    ),
  };
}

export function calculateOverallEvaluation(data: StoreData): OverallEvaluation {
  const profile = calculateTeacherProfile(data);
  const autonomy = professionalAutonomyScore(data.collaborationLogs);
  const issueRecords = data.teacherIssueRecords;
  const dimensions = [
    {
      key: 'studentLanguageOutput',
      label: '学生学习产出',
      score: averageAiOverallScore(issueRecords, 'studentLearningOutput')
        ?? profile.studentLanguageOutput,
      description: '看学生是否形成可观察的语言表达、课堂展示、练习结果或学习产物。',
    },
    {
      key: 'interactionQuality',
      label: '互动质量',
      score: averageAiOverallScore(issueRecords, 'interactionQuality')
        ?? profile.classroomGuidance,
      description: '看课堂互动是否促进真实思考与表达，而不是只统计问答次数。',
    },
    {
      key: 'feedbackRegulation',
      label: '反馈调控能力',
      score: averageAiOverallScore(issueRecords, 'feedbackRegulation')
        ?? profile.feedbackAndCorrection,
      description: '看教师能否基于学生回应及时追问、纠错、搭支架或调整节奏。',
    },
    {
      key: 'improvementTrend',
      label: '持续改进趋势',
      score: averageAiOverallScore(issueRecords, 'improvementTrend')
        ?? profile.improvementContinuity,
      description: '看上一轮问题是否被继续追踪，改进动作是否留下新证据。',
    },
    {
      key: 'professionalAutonomy',
      label: '专业自主调整',
      score: averageAiOverallScore(issueRecords, 'professionalAutonomy')
        ?? autonomy,
      description: '看教师是否能结合学生实际有依据地调整 AI 建议或原教案。',
    },
  ];
  const score = clampScore(average(dimensions.map((item) => item.score)));
  return { score, dimensions };
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
    .map(([month, value]) => {
      const monthData: StoreData = {
        artifacts: data.artifacts.filter((item) => item.createdAt.slice(0, 7) <= month),
        collaborationLogs: data.collaborationLogs.filter((item) => item.createdAt.slice(0, 7) <= month),
        improvementTasks: data.improvementTasks.filter((item) => item.createdAt.slice(0, 7) <= month),
        teacherIssueRecords: data.teacherIssueRecords.filter((item) => item.createdAt.slice(0, 7) <= month),
      };
      const profile = calculateTeacherProfile(monthData);
      const overall = calculateOverallEvaluation(monthData);
      return {
        month,
        score: overall.score || clampScore(value.logs * 12 + value.completedTasks * 30 + value.evidence * 10 + value.issueRecords * 20 + value.verified * 18),
        profile,
        overall,
        ...value,
      };
    });
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
  const overall = calculateOverallEvaluation(data);
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
- 整体评分：${overall.score}/100
- 课堂主导方式：${metrics.classroomGuidance}
- 问题设计质量：${metrics.questionQuality}
- 学生语言产出：${metrics.studentLanguageOutput}
- 活动组织与节奏：${metrics.activityPacing}
- 反馈与纠错能力：${metrics.feedbackAndCorrection}
- 持续改进趋势：${metrics.improvementContinuity}

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
