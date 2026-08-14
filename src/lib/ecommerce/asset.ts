/**
 * 跨境电商工作台 · 商品图片翻译（OCR + 翻译）
 * OCR：GLM-4V-Flash（复用 image-ocr）；翻译：DeepSeek 主 + GLM 降级（逐行对应）
 */
import { ocrImage } from '@/lib/image-ocr';
import { DeepSeekProvider } from '@/lib/translator/providers/deepseek';
import { GlmProvider } from '@/lib/translator/providers/glm';
import { getStorageService } from '@/lib/storage/storage-service';
import { toNameZh } from '@/lib/language-registry';

const deepseek = new DeepSeekProvider();
const glm = new GlmProvider();

export interface AssetTranslationResult {
  ocrLines: string[];
  translatedLines: string[];
}

function splitLines(text: string): string[] {
  return text.split('\n').map((s) => s.trim()).filter(Boolean);
}

/** 对 StorageService 中的图片做 OCR + 逐行翻译 */
export async function translateAssetImage(input: {
  storageKey: string;
  targetLang: string; // 2-letter ISO 639-1 code
}): Promise<AssetTranslationResult> {
  const storage = getStorageService();
  const file = await storage.get(input.storageKey);
  const base64 = file.data.toString('base64');

  // 1. OCR（GLM-4V-Flash）
  const { text, error } = await ocrImage(base64, file.contentType);
  if (error || !text) throw new Error(error || 'OCR 识别失败');
  if (text.includes('（图片中没有文字）')) throw new Error('这张图片里没有识别到文字');

  const ocrLines = splitLines(text);

  // 2. 逐行翻译（DeepSeek 主，60s 超时；失败降级 GLM）
  const targetLabel = toNameZh(input.targetLang);
  const prompt = [
    `把下面从图片中识别出的文字逐行翻译成${targetLabel}。`,
    '要求：',
    '1. 逐行对应翻译，保持原有行数与顺序，每行一条译文',
    '2. 广告语/招牌等按自然表达翻译，不要逐字硬译',
    '3. 只输出译文本身，不要解释',
    '',
    '识别文字：',
    text,
  ].join('\n');

  const attempt = async (provider: DeepSeekProvider | GlmProvider) => {
    const timer = new Promise<null>((res) => setTimeout(() => res(null), 60000));
    const call = provider.translate({ text: prompt, sourceLang: 'auto', targetLang: input.targetLang, scenario: 'image', maxTokens: 4096 });
    const r = await Promise.race([call, timer]);
    if (r === null) return { r: null, timedOut: true };
    return { r: r as any, timedOut: false };
  };

  let translation = '';
  const first = await attempt(deepseek);
  if (!first.r || first.r.error || first.timedOut) {
    const second = await attempt(glm);
    if (second.r && !second.r.error && !second.timedOut) {
      translation = second.r.text;
    } else {
      throw new Error('翻译服务繁忙，请稍后再试');
    }
  } else {
    translation = first.r.text;
  }

  const translatedLines = splitLines(translation);
  return { ocrLines, translatedLines };
}
