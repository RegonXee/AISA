// 百度OCR API客户端

const BAIDU_TOKEN_URL = 'https://aip.baidubce.com/oauth/2.0/token';
const BAIDU_OCR_URL = 'https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic';

interface OCROptions {
  apiKey: string;
  secretKey: string;
}

// 缓存access_token
let cachedToken: string = "";
let tokenExpireTime = 0;

async function getAccessToken(apiKey: string, secretKey: string): Promise<string> {
  // 如果缓存的token还没过期，直接用
  if (cachedToken && Date.now() < tokenExpireTime) {
    return cachedToken;
  }

  const url = `${BAIDU_TOKEN_URL}?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`;
  
  const response = await fetch(url, { method: 'POST' });
  if (!response.ok) {
    throw new Error('获取百度AccessToken失败');
  }
  
  const data = await response.json();
  if (data.error) {
    throw new Error(`百度认证失败: ${data.error_description || data.error}`);
  }
  
  cachedToken = data.access_token;
  // 提前5分钟过期
  tokenExpireTime = Date.now() + (data.expires_in - 300) * 1000;
  
  return cachedToken;
}

export async function ocrImage(imageBuffer: Buffer, options: OCROptions): Promise<string> {
  const { apiKey, secretKey } = options;
  
  // 获取access_token
  const token = await getAccessToken(apiKey, secretKey);
  
  // 图片转base64
  const base64Image = imageBuffer.toString('base64');
  
  // 调用OCR API（高精度版）
  const ocrUrl = `${BAIDU_OCR_URL}?access_token=${token}`;
  const response = await fetch(ocrUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `image=${encodeURIComponent(base64Image)}&detect_direction=true&paragraph=false`,
  });
  
  if (!response.ok) {
    throw new Error(`百度OCR请求失败: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (data.error_code) {
    throw new Error(`百度OCR错误: ${data.error_msg} (code: ${data.error_code})`);
  }
  
  if (!data.words_result || data.words_result.length === 0) {
    return '';
  }
  
  // 拼接所有识别到的文字
  const text = data.words_result
    .map((item: { words: string }) => item.words)
    .join('\n');
  
  return text;
}

// 批量OCR多张图片
export async function ocrImages(images: Buffer[], options: OCROptions): Promise<string> {
  const results = await Promise.all(
    images.map(img => ocrImage(img, options))
  );
  return results.filter(r => r.trim()).join('\n\n---\n\n');
}
