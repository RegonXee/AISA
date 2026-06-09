import { AVIA_VISION_SYSTEM_PROMPT, AVIA_VISION_USER_PROMPT } from './avia-vision-prompt';
import type { AviaPageImage } from './avia-pdf-images';

const DEFAULT_QWEN_ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const DEFAULT_QWEN_VISION_MODEL = 'qwen-vl-max';

export interface QwenVisionOptions {
  apiKey: string;
  endpoint?: string;
  model?: string;
}

export function hasQwenVisionConfig() {
  return Boolean(process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY);
}

function imageToDataUrl(image: AviaPageImage) {
  return `data:${image.mimeType};base64,${image.buffer.toString('base64')}`;
}

export async function analyzeAviaImagesWithQwen(images: AviaPageImage[], options: QwenVisionOptions) {
  if (images.length === 0) return '';

  const endpoint = options.endpoint || process.env.QWEN_API_ENDPOINT || DEFAULT_QWEN_ENDPOINT;
  const model = options.model || process.env.QWEN_VISION_MODEL || DEFAULT_QWEN_VISION_MODEL;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: AVIA_VISION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: AVIA_VISION_USER_PROMPT },
            ...images.flatMap((image) => [
              { type: 'text', text: `下面是${image.label}。` },
              { type: 'image_url', image_url: { url: imageToDataUrl(image) } },
            ]),
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 6000,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const detail = typeof errorData === 'object' ? JSON.stringify(errorData) : String(errorData);
    throw new Error(`千问视觉分析失败：HTTP ${response.status}；模型=${model}；接口=${endpoint}；错误=${errorData.error?.message || detail}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function analyzeAviaImagesWithQwenInBatches(images: AviaPageImage[], options: QwenVisionOptions) {
  const batchSize = Math.max(1, Number(process.env.QWEN_VISION_BATCH_SIZE || 1));
  const results: string[] = [];

  for (let index = 0; index < images.length; index += batchSize) {
    const batch = images.slice(index, index + batchSize);
    let batchResult = '';
    try {
      batchResult = await analyzeAviaImagesWithQwen(batch, options);
    } catch (error) {
      const batchLabel = batch.map((image) => image.label).join('、');
      throw new Error(`千问视觉批次 ${Math.floor(index / batchSize) + 1} 失败（${batchLabel}）：${error instanceof Error ? error.message : '未知错误'}`);
    }
    if (batchResult.trim()) {
      results.push(`## 千问视觉批次 ${Math.floor(index / batchSize) + 1}（${batch.map((image) => image.label).join('、')}）\n${batchResult}`);
    }
  }

  return results.join('\n\n---\n\n');
}
