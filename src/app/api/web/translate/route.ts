import { NextRequest, NextResponse } from 'next/server';
import { DeepSeekProvider } from '@/lib/translator/providers/deepseek';
import { GlmProvider } from '@/lib/translator/providers/glm';
import { fetchWebPage, validateUrl } from '@/lib/web-fetch';
import { getAuthUserId, authErrorBody, beginSync, endSyncSuccess, endSyncFail, estimateByChars, FEATURES } from '@/lib/credit/sync-settle';

export const runtime = 'nodejs';
export const maxDuration = 120;

const deepseek = new DeepSeekProvider();
const glm = new GlmProvider();

const BATCH_MAX_CHARS = 3000;

export async function POST(req: NextRequest) {
  let creditCtx: { jobId: string; usageId: string; estimated: number; userId: string } | null = null;
  try {
    const auth = await getAuthUserId();
    if (!auth) return NextResponse.json(authErrorBody(), { status: 401 });
    const body = await req.json();
    const { url, targetLang = 'zh' } = body || {};
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ ok: false, error: '请输入网页地址。' }, { status: 400 });
    }
    const v = validateUrl(url);
    if (v.error || !v.url) {
      return NextResponse.json({ ok: false, error: v.error }, { status: 400 });
    }

    const { title, paragraphs, error } = await fetchWebPage(v.url);
    if (error) return NextResponse.json({ ok: false, error }, { status: 502 });
    if (paragraphs.length === 0) {
      return NextResponse.json({ ok: false, error: '未能从该网页提取到正文内容（可能是 JS 渲染页面，建议换一个网址）。' }, { status: 422 });
    }

    // 分段：合并段落（每批 ≤3000 字符，带 [n] 序号）
    const targetLabel = targetLang === 'zh' ? '简体中文' : targetLang;
    const batches: { start: number; end: number; content: string }[] = [];
    let startIdx = 0;
    let lines: string[] = [];
    let len = 0;
    for (let i = 0; i < paragraphs.length; i++) {
      const add = `[${i + 1}] ${paragraphs[i]}`;
      if (len + add.length > BATCH_MAX_CHARS && lines.length > 0) {
        batches.push({ start: startIdx, end: i - 1, content: lines.join('\n') });
        lines = []; len = 0; startIdx = i;
      }
      lines.push(add);
      len += add.length;
    }
    if (lines.length) batches.push({ start: startIdx, end: paragraphs.length - 1, content: lines.join('\n') });

    // 积分：按总字符估算 → reserve（原子检查余额）
    const totalChars = paragraphs.reduce((s: number, p: string) => s + p.length, 0);
    const estCredits = await estimateByChars(FEATURES.WEB, totalChars);
    const jobId = `web_${crypto.randomUUID()}`;
    const begin = await beginSync({ userId: auth.userId, jobId, feature: FEATURES.WEB, estimatedCredits: estCredits });
    if (!begin.ok) return NextResponse.json({ ok: false, error: begin.error }, { status: 402 });
    creditCtx = { jobId, usageId: begin.usageId, estimated: begin.estimated, userId: auth.userId };
    let okChars = 0;

    const translations: string[] = new Array(paragraphs.length).fill('');
    const prompt = `把下面的网页段落逐条翻译成${targetLabel}。\n要求：\n1. 逐条翻译，输出格式固定为 [序号] 译文，一行一条，序号必须与输入一致\n2. 保持原文语气与信息完整性，专有名词保留或使用通用译法\n3. 只输出译文本身，不要解释\n\n网页段落：\n`;

    for (const batch of batches) {
      const fullPrompt = prompt + batch.content;
      // DeepSeek 主 → GLM 降级（60s 超时）
      const attempt = async (provider: DeepSeekProvider | GlmProvider) => {
        const timer = new Promise<null>((res) => setTimeout(() => res(null), 60000));
        const call = provider.translate({ text: fullPrompt, sourceLang: 'auto', targetLang, scenario: 'web', maxTokens: 4096 });
        const r = await Promise.race([call, timer]);
        if (r === null) return { r: null, timedOut: true };
        return { r: r as any, timedOut: false };
      };

      let { r, timedOut } = await attempt(deepseek);
      if (!r || r.error || timedOut) {
        const { r: r2, timedOut: t2 } = await attempt(glm);
        if (r2 && !r2.error && !t2) r = r2;
      }
      if (r && !r.error) {
        okChars += paragraphs.slice(batch.start, batch.end + 1).reduce((s: number, p: string) => s + p.length, 0);
        const linesOut = (r.text || '').split('\n');
        const map = new Map<number, string>();
        for (const line of linesOut) {
          const mm = line.match(/^\s*\[(\d+)\]\s*(.+)$/);
          if (mm) map.set(parseInt(mm[1], 10), mm[2].trim());
        }
        for (let i = batch.start; i <= batch.end; i++) {
          const tr = map.get(i + 1);
          if (tr) translations[i] = tr;
        }
      } else {
        for (let i = batch.start; i <= batch.end; i++) {
          translations[i] = paragraphs[i]; // 失败保留原文
        }
      }
    }

    const actualCredits = await estimateByChars(FEATURES.WEB, okChars);
    const settled = await endSyncSuccess({ userId: auth.userId, jobId, usageId: begin.usageId, estimated: begin.estimated, actualCredits });
    if (!settled.ok) return NextResponse.json({ ok: false, error: settled.error }, { status: 500 });

    return NextResponse.json({ ok: true, title, url: v.url, paragraphs, translations, total: paragraphs.length, credits: settled.consumed });
  } catch (e: any) {
    if (creditCtx) await endSyncFail({ userId: creditCtx.userId, jobId: creditCtx.jobId, usageId: creditCtx.usageId, estimated: creditCtx.estimated });
    console.error('[web/translate]', e?.message || e);
    return NextResponse.json({ ok: false, error: '服务器繁忙，请稍后再试。' }, { status: 500 });
  }
}
