const DEFAULT_SILICONFLOW_ENDPOINT = 'https://api.siliconflow.cn/v1/chat/completions';
const DEFAULT_SILICONFLOW_VISION_MODEL = 'Qwen/Qwen3-VL-32B-Instruct';
const DEFAULT_PAGE_MAX_TOKENS = 8192;
const DEFAULT_REQUEST_TIMEOUT_MS = 120000;

interface SiliconFlowVisionOptions {
  apiKey: string;
  apiKeys?: string[];
  endpoint?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

interface AnalyzePageInput {
  pageNumber: number;
  totalPages: number;
  imageBuffer: Buffer;
  baiduOcrText: string;
}

function imageToDataUrl(imageBuffer: Buffer) {
  return `data:image/png;base64,${imageBuffer.toString('base64')}`;
}

function readProviderError(errorData: unknown) {
  if (typeof errorData !== 'object' || errorData === null) return String(errorData);
  const record = errorData as { error?: { message?: string }; message?: string };
  return record.error?.message || record.message || JSON.stringify(errorData);
}

function splitApiKeys(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getSiliconFlowApiKeys() {
  const numberedKeys = [
    process.env.SILICONFLOW_API_KEY_1,
    process.env.SILICONFLOW_API_KEY_2,
    process.env.SILICONFLOW_API_KEY_3,
    process.env.SILICONFLOW_API_KEY_4,
    process.env.SILICONFLOW_API_KEY_5,
  ].filter((item): item is string => Boolean(item?.trim()));
  const keys = [
    ...splitApiKeys(process.env.SILICONFLOW_API_KEYS || ''),
    ...numberedKeys,
    process.env.SILICONFLOW_API_KEY || '',
  ].filter(Boolean);

  return Array.from(new Set(keys));
}

function pickApiKey(options: SiliconFlowVisionOptions, pageNumber: number) {
  const apiKeys = options.apiKeys?.length ? options.apiKeys : [options.apiKey].filter(Boolean);
  return apiKeys[(Math.max(1, pageNumber) - 1) % apiKeys.length] || '';
}

export function getSiliconFlowVisionConfig() {
  const apiKeys = getSiliconFlowApiKeys();
  return {
    apiKey: apiKeys[0] || '',
    apiKeys,
    endpoint: process.env.SILICONFLOW_API_ENDPOINT || DEFAULT_SILICONFLOW_ENDPOINT,
    model: process.env.SILICONFLOW_VISION_MODEL || DEFAULT_SILICONFLOW_VISION_MODEL,
    maxTokens: Math.max(1024, Number(process.env.SILICONFLOW_VISION_MAX_TOKENS || DEFAULT_PAGE_MAX_TOKENS)),
    temperature: Number(process.env.SILICONFLOW_VISION_TEMPERATURE || 0.1),
    timeoutMs: Math.max(10000, Number(process.env.SILICONFLOW_VISION_TIMEOUT_MS || DEFAULT_REQUEST_TIMEOUT_MS)),
  };
}

export function hasSiliconFlowVisionConfig() {
  return getSiliconFlowVisionConfig().apiKeys.length > 0;
}

export async function analyzeAviaPageWithSiliconFlow(input: AnalyzePageInput, options: SiliconFlowVisionOptions) {
  const endpoint = options.endpoint || DEFAULT_SILICONFLOW_ENDPOINT;
  const model = options.model || DEFAULT_SILICONFLOW_VISION_MODEL;
  const maxTokens = options.maxTokens || DEFAULT_PAGE_MAX_TOKENS;
  const temperature = options.temperature ?? 0.1;
  const timeoutMs = options.timeoutMs || DEFAULT_REQUEST_TIMEOUT_MS;
  const apiKey = pickApiKey(options, input.pageNumber);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  if (!apiKey) {
    clearTimeout(timeout);
    throw new Error('未配置 SILICONFLOW_API_KEY 或 SILICONFLOW_API_KEYS，无法调用硅基流动视觉模型。');
  }

  const prompt = `请将这张奥威亚 AI课堂基础分析报告图片中的所有内容完整转为结构化 Markdown。

硬性要求：
- 保留所有标题层级，用 #、##、### 表示。
- 表格必须用 Markdown 的 | 表格格式还原；复杂表格可用 HTML table。
- 保留列表、编号、指标名称、数值、百分比、次数、时间、评分、问题列表、语音转写。
- 不要遗漏任何文字；不要只描述图片。
- 百度 OCR 文本只作为保底和交叉校验，最终以图片中可见内容为准。
- 如果图片与 OCR 冲突，请在“本页校验说明”中说明。
- 看不清或无法可靠识别的内容写“未能可靠识别”，不要编造。
- 只输出本页 Markdown。

页码：第 ${input.pageNumber}/${input.totalPages} 页

百度 OCR 保底文本：
${input.baiduOcrText.trim() || '百度 OCR 未识别到有效文字。'}`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: imageToDataUrl(input.imageBuffer) },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
        max_tokens: maxTokens,
        temperature,
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`硅基流动视觉识别超时：第 ${input.pageNumber}/${input.totalPages} 页超过 ${Math.round(timeoutMs / 1000)} 秒未返回。`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`硅基流动视觉识别失败：HTTP ${response.status}；模型=${model}；接口=${endpoint}；错误=${readProviderError(errorData)}`);
  }

  const data = await response.json();
  return String(data.choices?.[0]?.message?.content || '').trim();
}
