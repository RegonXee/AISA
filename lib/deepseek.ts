// DeepSeek API 客户端

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const VISION_MODEL = 'deepseek-chat'; // DeepSeek V3 支持多模态

export type MessageContent = string | Array<{type: string; text?: string; image_url?: {url: string}}>;

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: MessageContent;
}

export interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
}

// 检测消息是否包含图片
function hasImages(messages: Message[]): boolean {
  return messages.some(m => Array.isArray(m.content) && m.content.some(c => c.type === 'image_url'));
}

export async function streamChat(
  messages: Message[],
  apiKey: string,
  callbacks: StreamCallbacks
): Promise<void> {
  try {
    // 如果包含图片，使用视觉模型
    const useVision = hasImages(messages);
    
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: messages,
        stream: true,
        temperature: 0.7,
        max_tokens: 16384,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errMsg = errorData.error?.message || `API请求失败: ${response.status}`;
      throw new Error(errMsg);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法读取响应流');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            callbacks.onComplete();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              callbacks.onChunk(content);
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    }

    callbacks.onComplete();
  } catch (error) {
    callbacks.onError(error instanceof Error ? error : new Error('未知错误'));
  }
}

export async function chat(
  messages: Message[],
  apiKey: string
): Promise<string> {
  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: messages,
        stream: false,
        temperature: 0.7,
        max_tokens: 16384,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API请求失败: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (error) {
    throw error instanceof Error ? error : new Error('未知错误');
  }
}
