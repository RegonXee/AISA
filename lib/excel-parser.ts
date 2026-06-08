import * as XLSX from 'xlsx';

export interface QuestionData {
  questionNumber: string;
  section: string;
  maxScore: number;
  avgScore: number;
  errorRate: number;
  errorRatePercent: string;
}

export interface SectionData {
  questions: QuestionData[];
  totalErrorRate: number;
}

export interface ExcelParseResult {
  totalStudents: number;
  questions: QuestionData[];
  sections: Record<string, SectionData>;
}

type SheetCell = string | number | null | undefined;
type SheetRow = SheetCell[];

type SectionConfig = {
  startCol: number;
  endCol: number;
  totalCol: number;
  maxScore: number;
  startQuestion: number;
  isTotalOnly?: boolean;
  displayName?: string;
};

const FALLBACK_SECTION_CONFIG: Record<string, SectionConfig> = {
  语法选择: { startCol: 7, endCol: 16, totalCol: 17, maxScore: 1, startQuestion: 31 },
  完形填空: { startCol: 18, endCol: 27, totalCol: 28, maxScore: 1, startQuestion: 41 },
  阅读理解: { startCol: 29, endCol: 43, totalCol: 44, maxScore: 2, startQuestion: 51 },
  短文填空: {
    startCol: 47,
    endCol: 47,
    totalCol: 47,
    maxScore: 10,
    startQuestion: 0,
    isTotalOnly: true,
    displayName: '76-80',
  },
  回答问题: {
    startCol: 48,
    endCol: 48,
    totalCol: 48,
    maxScore: 10,
    startQuestion: 0,
    isTotalOnly: true,
    displayName: '81',
  },
  作文: {
    startCol: 49,
    endCol: 49,
    totalCol: 49,
    maxScore: 15,
    startQuestion: 0,
    isTotalOnly: true,
    displayName: '作文',
  },
};

const SECTION_ORDER = ['语法选择', '完形填空', '阅读理解', '短文填空', '回答问题', '作文'];

function toText(value: SheetCell) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function numberValue(value: SheetCell) {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).replace('%', '').trim();
  const parsed = typeof value === 'number' ? value : Number.parseFloat(text);
  return Number.isNaN(parsed) ? null : parsed;
}

function isLikelyStudentRow(row: SheetRow) {
  const filled = row.filter((cell) => toText(cell)).length;
  const numeric = row.filter((cell) => numberValue(cell) !== null).length;
  return filled >= 4 && numeric >= 2;
}

function getSectionMaxScore(section: string) {
  if (section === '阅读理解') return 30;
  if (section === '作文') return 15;
  if (section === '短文填空' || section === '回答问题') return 10;
  return 10;
}

function inferSection(questionNumber: number, header: string) {
  if (/作文|写作|writing/i.test(header)) return '作文';
  if (/回答|问答|简答|answer/i.test(header)) return '回答问题';
  if (/短文|语篇|填空|blank/i.test(header) && questionNumber >= 66) return '短文填空';
  if (/阅读|理解|reading/i.test(header)) return '阅读理解';
  if (/完形|cloze/i.test(header)) return '完形填空';
  if (/语法|选择|单选|grammar/i.test(header)) return '语法选择';
  if (questionNumber >= 31 && questionNumber <= 40) return '语法选择';
  if (questionNumber >= 41 && questionNumber <= 50) return '完形填空';
  if (questionNumber >= 51 && questionNumber <= 65) return '阅读理解';
  if (questionNumber >= 66 && questionNumber <= 80) return '短文填空';
  if (questionNumber >= 81 && questionNumber <= 85) return '回答问题';
  return '其他题目';
}

function inferQuestionNumber(header: string, index: number) {
  if (/作文|写作|writing/i.test(header)) return '作文';
  const normalized = header.replace(/\s/g, '');
  const patterns = [
    /第?(\d{1,3})题/,
    /题?(\d{1,3})$/,
    /^Q(\d{1,3})$/i,
    /^(\d{1,3})$/,
    /(\d{1,3})[、.．]/,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) return match[1];
  }
  return `列${index + 1}`;
}

function inferMaxScore(questionNumber: string, section: string, values: number[]) {
  if (section === '作文') return Math.max(15, Math.ceil(Math.max(...values, 0)));
  if (section === '阅读理解') return 2;
  if (section === '短文填空' && questionNumber.includes('-')) return 10;
  if (section === '回答问题') return Math.max(5, Math.ceil(Math.max(...values, 0)));
  const maxObserved = Math.max(...values, 0);
  if (maxObserved > 2) return Math.ceil(maxObserved);
  return 1;
}

function isScoreHeader(header: string) {
  const text = header.toLowerCase();
  if (!text) return false;
  if (/姓名|班级|考号|准考|学号|学校|序号|总分|等级|排名|名次|备注/.test(header)) return false;
  return /第?\d{1,3}题|^q\d{1,3}$|题?\d{1,3}$|作文|写作|reading|writing|grammar|cloze|blank|answer/i.test(text);
}

function findHeaderRow(rows: SheetRow[]) {
  const limit = Math.min(rows.length, 12);
  let best = { index: 0, score: -1 };
  for (let index = 0; index < limit; index += 1) {
    const row = rows[index];
    const score = row.filter((cell) => isScoreHeader(toText(cell))).length;
    if (score > best.score) best = { index, score };
  }
  return best.score >= 3 ? best.index : -1;
}

function calculateQuestion(questionNumber: string, section: string, values: number[]) {
  const maxScore = inferMaxScore(questionNumber, section, values);
  const avgScore = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const errorRate = Math.max(0, 1 - avgScore / maxScore);
  return {
    questionNumber,
    section,
    maxScore,
    avgScore: Math.round(avgScore * 100) / 100,
    errorRate: Math.round(errorRate * 1000) / 1000,
    errorRatePercent: `${Math.round(errorRate * 100)}%`,
  };
}

function buildResult(totalStudents: number, questions: QuestionData[]): ExcelParseResult {
  const sections: Record<string, SectionData> = {};

  for (const question of questions) {
    if (!sections[question.section]) {
      sections[question.section] = { questions: [], totalErrorRate: 0 };
    }
    sections[question.section].questions.push(question);
  }

  for (const sectionName of Object.keys(sections)) {
    const section = sections[sectionName];
    const avgError = section.questions.length
      ? section.questions.reduce((sum, question) => sum + question.errorRate, 0) / section.questions.length
      : 0;
    section.totalErrorRate = Math.round(avgError * 1000) / 1000;
    section.questions.sort((a, b) => b.errorRate - a.errorRate);
  }

  const orderedSections: Record<string, SectionData> = {};
  for (const sectionName of SECTION_ORDER) {
    if (sections[sectionName]) orderedSections[sectionName] = sections[sectionName];
  }
  for (const [sectionName, section] of Object.entries(sections)) {
    if (!orderedSections[sectionName]) orderedSections[sectionName] = section;
  }

  questions.sort((a, b) => b.errorRate - a.errorRate);
  return { totalStudents, questions, sections: orderedSections };
}

function parseByHeaders(rows: SheetRow[]): ExcelParseResult | null {
  const headerIndex = findHeaderRow(rows);
  if (headerIndex < 0) return null;

  const headers = rows[headerIndex].map(toText);
  const studentRows = rows.slice(headerIndex + 1).filter(isLikelyStudentRow);
  if (studentRows.length === 0) return null;

  const questions: QuestionData[] = [];

  headers.forEach((header, colIndex) => {
    if (!isScoreHeader(header)) return;
    const values = studentRows
      .map((row) => numberValue(row[colIndex]))
      .filter((value): value is number => value !== null);
    if (values.length < Math.max(2, Math.floor(studentRows.length * 0.25))) return;

    const questionNumber = inferQuestionNumber(header, colIndex);
    const section = questionNumber === '作文'
      ? '作文'
      : inferSection(Number.parseInt(questionNumber, 10), header);
    questions.push(calculateQuestion(questionNumber, section, values));
  });

  return questions.length >= 3 ? buildResult(studentRows.length, questions) : null;
}

function parseByFallbackColumns(rows: SheetRow[]): ExcelParseResult {
  const studentRows = rows.slice(1).filter((row) => toText(row[0]) && toText(row[0]) !== '-');
  const questions: QuestionData[] = [];

  for (const [sectionName, config] of Object.entries(FALLBACK_SECTION_CONFIG)) {
    if (config.isTotalOnly) {
      const values = studentRows
        .map((row) => numberValue(row[config.totalCol]))
        .filter((value): value is number => value !== null);
      if (values.length > 0) {
        questions.push(calculateQuestion(config.displayName || sectionName, sectionName, values));
      }
      continue;
    }

    for (let col = config.startCol; col <= config.endCol; col += 1) {
      const values = studentRows
        .map((row) => numberValue(row[col]))
        .filter((value): value is number => value !== null);
      if (values.length === 0) continue;
      questions.push(calculateQuestion(String(config.startQuestion + (col - config.startCol)), sectionName, values));
    }
  }

  if (questions.length === 0) {
    throw new Error('未识别到可用的小题得分列。请确认表格中包含题号列，或使用系统要求的固定列格式。');
  }

  return buildResult(studentRows.length, questions);
}

export function parseExcel(buffer: Buffer): ExcelParseResult {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const preferredSheet = workbook.SheetNames.find((name) => /全卷|成绩|分数|score/i.test(name)) || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[preferredSheet];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as SheetRow[];

    if (rows.length < 2) throw new Error('Excel 文件数据不足');

    const headerParsed = parseByHeaders(rows);
    if (headerParsed) return headerParsed;

    return parseByFallbackColumns(rows);
  } catch (error) {
    throw new Error(`Excel 解析失败：${error instanceof Error ? error.message : '未知错误'}`);
  }
}

export function formatErrorRateData(data: ExcelParseResult): string {
  let output = `## 学生答题数据\n总人数：${data.totalStudents}人\n\n`;

  for (const [sectionName, sectionData] of Object.entries(data.sections)) {
    output += `### ${sectionName}\n本题型平均错误率：${Math.round(sectionData.totalErrorRate * 100)}%\n\n`;
    for (const question of sectionData.questions) {
      output += `- 第${question.questionNumber}题：错误率${question.errorRatePercent}，平均分${question.avgScore}/${question.maxScore}\n`;
    }
    output += '\n';
  }

  output += '### 各题错误率排序（从高到低）\n';
  for (const question of data.questions) {
    output += `- ${question.section} 第${question.questionNumber}题：${question.errorRatePercent}\n`;
  }

  return output;
}

