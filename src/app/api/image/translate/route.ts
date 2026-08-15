import { NextRequest, NextResponse } from 'next/server';
import { DeepSeekProvider } from '@/lib/translator/providers/deepseek';
import { GlmProvider } from '@/lib/translator/providers/glm';
import { ocrImage } from '@/lib/image-ocr';
import { getAuthUserId, authErrorBody, beginSync, endSyncSuccess, endSyncFail, estimateByChars, FEATURES } from '@/lib/credit/sync-settle';

export const runtime = 'nodejs';
export const maxDuration = 90;

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

const deepseek = new DeepSeekProvider();
const glm = new GlmProvider();

export async function POST(req: NextRequest) {
  let creditCtx: { jobId: string; usageId: string; estimated: number; userId: string } | null = null;
  try {
    const auth = await getAuthUserId();
    if (!auth) return NextResponse.json(authErrorBody(), { status: 401 });
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const targetLang = String(form.get('targetLang') || 'zh');

    if (!file || !file.name) {
      return NextResponse.json({ ok: false, error: '请选择图片文件。' }, { status: 400 });
    }
    const mime = file.type || 'image/png';
    if (!ALLOWED.has(mime)) {
      return NextResponse.json({ ok: false, error: '仅支持 PNG / JPG / WebP / GIF 图片。' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ ok: false, error: '图片过大（限 5MB）。' }, { status: 400 });
    }

    // OCR（GLM-4V-Flash）
    const buf = Buffer.from(await file.arrayBuffer());
    const base64 = buf.toString('base64');
    const { text, error } = await ocrImage(base64, mime);
    if (error || !text) {
      return NextResponse.json({ ok: false, error: error || 'OCR 识别失败。' }, { status: 502 });
    }
    if (text.includes('（图片中没有文字）')) {
      return NextResponse.json({ ok: false, error: '这张图片里没有识别到文字。' }, { status: 422 });
    }

    // 积分：图片固定 3 积分/张 → reserve（原子检查余额）
    const jobId = `img_${crypto.randomUUID()}`;
    const begin = await beginSync({ userId: auth.userId, jobId, feature: FEATURES.IMAGE, estimatedCredits: 3 });
    if (!begin.ok) return NextResponse.json({ ok: false, error: begin.error }, { status: 402 });
    creditCtx = { jobId, usageId: begin.usageId, estimated: begin.estimated, userId: auth.userId };

    // 翻译（DeepSeek 主，60s 超时；失败降级 GLM）
    const targetLabel = targetLang === 'zh' ? '简体中文' : targetLang;
    const prompt = `把下面从图片中识别出的文字逐行翻译成${targetLabel}。\n要求：\n1. 逐行对应翻译，保持原有行数与顺序，每行一条译文\n2. 广告语/招牌等按自然表达翻译，不要逐字硬译\n3. 只输出译文本身，不要解释\n\n识别文字：\n${text}`;

    const attempt = async (provider: DeepSeekProvider | GlmProvider) => {
      const timer = new Promise<null>((res) => setTimeout(() => res(null), 60000));
      const call = provider.translate({ text: prompt, sourceLang: 'auto', targetLang, scenario: 'image', maxTokens: 4096 });
      const r = await Promise.race([call, timer]);
      if (r === null) return { r: null, timedOut: true };
      return { r: r as any, timedOut: false };
    };

    let translation = '';
    let model = 'deepseek';
    let { r, timedOut } = await attempt(deepseek);
    if (!r || r.error || timedOut) {
      const { r: r2, timedOut: t2 } = await attempt(glm);
      if (r2 && !r2.error && !t2) { translation = r2.text; model = 'glm'; }
      else { await endSyncFail({ userId: auth.userId, jobId, usageId: begin.usageId, estimated: begin.estimated }); return NextResponse.json({ ok: false, error: '翻译服务繁忙，请稍后再试。' }, { status: 502 }); }
    } else {
      translation = r.text;
    }

    await endSyncSuccess({ userId: auth.userId, jobId, usageId: begin.usageId, estimated: begin.estimated, actualCredits: 3 });
    return NextResponse.json({ ok: true, text, translation, model, credits: 3 });
  } catch (e: any) {
    if (creditCtx) await endSyncFail({ userId: creditCtx.userId, jobId: creditCtx.jobId, usageId: creditCtx.usageId, estimated: creditCtx.estimated });
    console.error('[image/translate]', e?.message || e);
    return NextResponse.json({ ok: false, error: '服务器繁忙，请稍后再试。' }, { status: 500 });
  }
}
