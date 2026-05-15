// Excel解析工具 - 解析成绩Excel文件

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

// Excel列配置 - 基于"全卷"sheet的实际结构
// 列7-16: 第31-40题（语法选择，每题1分）
// 列17: 语法选择总分
// 列18-27: 第41-50题（完型填空，每题1分）
// 列28: 完型填空总分
// 列29-43: 第51-65题（阅读理解，每题2分）
// 列44: 阅读理解总分
// 列45: 66-70总分
// 列46: 71-75总分
// 列47: 短文填空总分
// 列48: 回答问题总分
// 列49: 作文

type SectionConfig = {
  startCol: number;
  endCol: number;
  totalCol: number;
  maxScore: number;
  startQuestion: number;
  isTotalOnly?: boolean;
  displayName?: string;
};

const SECTION_CONFIG: Record<string, SectionConfig> = {
  '语法选择': {
    startCol: 7,
    endCol: 16,
    totalCol: 17,
    maxScore: 1,
    startQuestion: 31,  // 起始题号
  },
  '完型填空': {
    startCol: 18,
    endCol: 27,
    totalCol: 28,
    maxScore: 1,
    startQuestion: 41,
  },
  '阅读理解': {
    startCol: 29,
    endCol: 43,
    totalCol: 44,
    maxScore: 2,
    startQuestion: 51,
  },
  '短文填空': {
    startCol: 47,
    endCol: 47,
    totalCol: 47,
    maxScore: 10,
    startQuestion: 0,  // 只有总分，没有逐题
    isTotalOnly: true,
    displayName: '76-80',
  },
  '回答问题': {
    startCol: 48,
    endCol: 48,
    totalCol: 48,
    maxScore: 10,
    startQuestion: 0,
    isTotalOnly: true,
    displayName: '81',
  },
  '作文': {
    startCol: 49,
    endCol: 49,
    totalCol: 49,
    maxScore: 15,
    startQuestion: 0,
    isTotalOnly: true,
    displayName: '作文',
  },
};

export function parseExcel(buffer: Buffer): ExcelParseResult {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    // 优先读取"全卷"sheet
    let sheetName = '全卷';
    if (!workbook.SheetNames.includes(sheetName)) {
      sheetName = workbook.SheetNames[0];
    }
    
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as (string | number | null)[][];
    
    if (data.length < 2) {
      throw new Error('Excel文件数据不足');
    }
    
    // 计算学生总数（跳过表头行，跳过空行和分隔行）
    let totalStudents = 0;
    for (let row = 1; row < data.length; row++) {
      const rowVal = data[row][0];
      if (rowVal !== null && rowVal !== undefined && rowVal !== '' && rowVal !== '-') {
        totalStudents++;
      }
    }
    
    const allQuestions: QuestionData[] = [];
    const sections: Record<string, SectionData> = {};
    
    for (const [sectionName, config] of Object.entries(SECTION_CONFIG)) {
      const sectionQuestions: QuestionData[] = [];
      
      if (config.isTotalOnly) {
        // 只有总分的题型（短文填空、回答问题、作文）
        let totalSum = 0;
        let validCount = 0;
        
        for (let row = 1; row < data.length; row++) {
          const rowVal = data[row][0];
          if (rowVal === null || rowVal === undefined || rowVal === '' || rowVal === '-') continue;
          
          const cellValue = data[row][config.totalCol];
          if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
            const score = typeof cellValue === 'number' ? cellValue : parseFloat(String(cellValue));
            if (!isNaN(score)) {
              totalSum += score;
              validCount++;
            }
          }
        }
        
        const avgScore = validCount > 0 ? totalSum / validCount : 0;
        const errorRate = 1 - (avgScore / config.maxScore);
        
        const questionData: QuestionData = {
          questionNumber: config.displayName || sectionName,
          section: sectionName,
          maxScore: config.maxScore,
          avgScore: Math.round(avgScore * 100) / 100,
          errorRate: Math.round(errorRate * 1000) / 1000,
          errorRatePercent: `${Math.round(errorRate * 100)}%`,
        };
        
        sectionQuestions.push(questionData);
        allQuestions.push(questionData);
        
        sections[sectionName] = {
          questions: sectionQuestions,
          totalErrorRate: Math.round(errorRate * 1000) / 1000,
        };
      } else {
        // 有逐题得分的题型
        for (let col = config.startCol; col <= config.endCol; col++) {
          let sum = 0;
          let validCount = 0;
          
          for (let row = 1; row < data.length; row++) {
            const rowVal = data[row][0];
            if (rowVal === null || rowVal === undefined || rowVal === '' || rowVal === '-') continue;
            
            const cellValue = data[row][col];
            if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
              const score = typeof cellValue === 'number' ? cellValue : parseFloat(String(cellValue));
              if (!isNaN(score)) {
                sum += score;
                validCount++;
              }
            }
          }
          
          const avgScore = validCount > 0 ? sum / validCount : 0;
          const errorRate = 1 - (avgScore / config.maxScore);
          const displayNumber = String(config.startQuestion + (col - config.startCol));
          
          const questionData: QuestionData = {
            questionNumber: displayNumber,
            section: sectionName,
            maxScore: config.maxScore,
            avgScore: Math.round(avgScore * 100) / 100,
            errorRate: Math.round(errorRate * 1000) / 1000,
            errorRatePercent: `${Math.round(errorRate * 100)}%`,
          };
          
          sectionQuestions.push(questionData);
          allQuestions.push(questionData);
        }
        
        // 计算该题型总错误率（基于总分列）
        let totalSum = 0;
        let totalValidCount = 0;
        
        for (let row = 1; row < data.length; row++) {
          const rowVal = data[row][0];
          if (rowVal === null || rowVal === undefined || rowVal === '' || rowVal === '-') continue;
          
          const cellValue = data[row][config.totalCol];
          if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
            const score = typeof cellValue === 'number' ? cellValue : parseFloat(String(cellValue));
            if (!isNaN(score)) {
              totalSum += score;
              totalValidCount++;
            }
          }
        }
        
        const sectionMaxScore = getSectionMaxScore(sectionName);
        const sectionAvgScore = totalValidCount > 0 ? totalSum / totalValidCount : 0;
        const sectionErrorRate = 1 - (sectionAvgScore / sectionMaxScore);
        
        sections[sectionName] = {
          questions: sectionQuestions,
          totalErrorRate: Math.round(sectionErrorRate * 1000) / 1000,
        };
      }
    }
    
    // 按错误率降序排序
    allQuestions.sort((a, b) => b.errorRate - a.errorRate);
    
    return {
      totalStudents,
      questions: allQuestions,
      sections,
    };
  } catch (error) {
    throw new Error(`Excel解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

function getSectionMaxScore(section: string): number {
  switch (section) {
    case '语法选择':
      return 10;
    case '完型填空':
      return 10;
    case '阅读理解':
      return 30;
    case '短文填空':
      return 10;
    case '回答问题':
      return 10;
    case '作文':
      return 15;
    default:
      return 10;
  }
}

// 格式化错误率数据为可读文本
export function formatErrorRateData(data: ExcelParseResult): string {
  let output = `## 学生答题数据
总人数: ${data.totalStudents}人

`;
  
  for (const [sectionName, sectionData] of Object.entries(data.sections)) {
    output += `### ${sectionName}
本大题错误率: ${Math.round(sectionData.totalErrorRate * 100)}%

`;
    
    for (const q of sectionData.questions) {
      output += `- 第${q.questionNumber}题: 错误率${q.errorRatePercent}（平均分${q.avgScore}/${q.maxScore}）
`;
    }
    output += '\n';
  }
  
  // 按错误率排序的汇总
  output += `### 各题错误率排序（从高到低）

`;
  for (const q of data.questions) {
    output += `- ${q.section}第${q.questionNumber}题: ${q.errorRatePercent}
`;
  }
  
  return output;
}
