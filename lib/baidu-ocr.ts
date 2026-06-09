const BAIDU_TOKEN_URL = 'https://aip.baidubce.com/oauth/2.0/token';
const BAIDU_OCR_URL = 'https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic';
const DEFAULT_BAIDU_OCR_TIMEOUT_MS = 45000;

interface OCROptions {
  apiKey: string;
  secretKey: string;
}

let cachedToken = '';
let tokenExpireTime = 0;

function getBaiduOcrTimeoutMs() {
  return Math.max(5000, Number(process.env.BAIDU_OCR_TIMEOUT_MS || DEFAULT_BAIDU_OCR_TIMEOUT_MS));
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`百度 OCR 请求超时：超过 ${Math.round(timeoutMs / 1000)} 秒未返回`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function getAccessToken(apiKey: string, secretKey: string): Promise<string> {
  if (cachedToken && Date.now() < tokenExpireTime) return cachedToken;

  const url = `${BAIDU_TOKEN_URL}?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`;
  const response = await fetchWithTimeout(url, { method: 'POST' }, getBaiduOcrTimeoutMs());
  if (!response.ok) throw new Error('获取百度 OCR AccessToken 失败');

  const data = await response.json();
  if (data.error) {
    throw new Error(`百度 OCR 认证失败：${data.error_description || data.error}`);
  }

  cachedToken = data.access_token;
  tokenExpireTime = Date.now() + (data.expires_in - 300) * 1000;
  return cachedToken;
}

export async function ocrImage(imageBuffer: Buffer, options: OCROptions): Promise<string> {
  const token = await getAccessToken(options.apiKey, options.secretKey);
  const base64Image = imageBuffer.toString('base64');
  const response = await fetchWithTimeout(`${BAIDU_OCR_URL}?access_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `image=${encodeURIComponent(base64Image)}&detect_direction=true&paragraph=false`,
  }, getBaiduOcrTimeoutMs());

  if (!response.ok) throw new Error(`百度 OCR 请求失败：${response.status}`);

  const data = await response.json();
  if (data.error_code) {
    throw new Error(`百度 OCR 错误：${data.error_msg} (${data.error_code})`);
  }

  return (data.words_result || [])
    .map((item: { words: string }) => item.words)
    .filter(Boolean)
    .join('\n');
}

export async function ocrImages(images: Buffer[], options: OCROptions): Promise<string> {
  const results = await Promise.all(images.map((image) => ocrImage(image, options)));
  return results.filter((text) => text.trim()).join('\n\n---\n\n');
}
