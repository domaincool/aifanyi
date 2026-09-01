import { NextRequest, NextResponse } from 'next/server';
import { DeepSeekProvider } from '@/lib/translator/providers/deepseek';
import { GlmProvider } from '@/lib/translator/providers/glm';
import { parseDocFile } from '@/lib/doc-parser';
import { checkFairUse } from '@/lib/fairuse-quota';
import { getAuthUserId, authErrorBody, beginSync, endSyncSuccess, endSyncFail, estimateByChars, FEATURES } from '@/lib/credit/sync-settle';

export const runtime = 'nodejs';
export const maxDuration = 120;

const MAX_SIZE = 10 * 1024 * 1024;
const MAX_PARAS = 300;

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
      return NextResponse.json({ ok: false, error: '请选择文档文件。' }, { status: 400 });
    }
    if (!/\.(docx?|pptx?)$/i.test(file.name)) {
      return NextResponse.json({ ok: false, error: '仅支持 Word(.docx) / PPT(.pptx) 文件。' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ ok: false, error: '文件过大（限 10MB）。' }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const { paragraphs, format, error } = parseDocFile(buf, file.name);
    if (error || paragraphs.length === 0) {
      return NextResponse.json({ ok: false, error: error || '无法解析文档。' }, { status: 400 });
    }
    const limited = paragraphs.slice(0, MAX_PARAS);

    // 分批翻译（≤20 段 / ≤3000 字符）
    const targetLabel = targetLang === 'zh' ? '简体中文' : targetLang;
    const batches: { start: number; end: number; content: string }[] = [];
    let startIdx = 0, lines: string[] = [], len = 0;
    for (let i = 0; i < limited.length; i++) {
      const add = `[${i + 1}] ${limited[i].text}`;
      if ((len + add.length > 3000 || i - startIdx >= 20) && lines.length > 0) {
        batches.push({ start: startIdx, end: i - 1, content: lines.join('\n') });
        lines = []; len = 0; startIdx = i;
      }
      lines.push(add); len += add.length;
    }
    if (lines.length) batches.push({ start: startIdx, end: limited.length - 1, content: lines.join('\n') });

    // B2 公平使用双阈值（登录：10 文件/日硬阈值，软阈值打点）
    const fu = await checkFairUse({ userId: auth.userId });
    if (!fu.ok) {
      return NextResponse.json({ ok: false, code: 'fair_use_limit_reached', error: fu.message }, { status: 429 });
    }

    // 积分：按总字符估算 → reserve（原子检查余额）
    const totalChars = limited.reduce((s: number, p: any) => s + (p.text || '').length, 0);
    const estCredits = await estimateByChars(FEATURES.DOC, totalChars);
    const jobId = `doc_${crypto.randomUUID()}`;
    const begin = await beginSync({ userId: auth.userId, jobId, feature: FEATURES.DOC, estimatedCredits: estCredits });
    if (!begin.ok) return NextResponse.json({ ok: false, error: begin.error }, { status: 402 });
    creditCtx = { jobId, usageId: begin.usageId, estimated: begin.estimated, userId: auth.userId };
    let okChars = 0;

    const translations: string[] = new Array(limited.length).fill('');
    const prompt = `把下面的${format === 'docx' ? 'Word 文档段落' : 'PPT 幻灯片文本'}逐条翻译成${targetLabel}。\n要求：\n1. 逐条翻译，输出格式固定为 [序号] 译文，一行一条，序号必须与输入一致\n2. 保持文档语气与专业术语的准确性，专有名词保留或使用通用译法\n3. 只输出译文本身，不要解释\n\n内容：\n`;

    for (const batch of batches) {
      const fullPrompt = prompt + batch.content;
      const attempt = async (provider: DeepSeekProvider | GlmProvider) => {
        const timer = new Promise<null>((res) => setTimeout(() => res(null), 60000));
        const call = provider.translate({ text: fullPrompt, sourceLang: 'auto', targetLang, scenario: 'doc', maxTokens: 4096 });
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
        okChars += limited.slice(batch.start, batch.end + 1).reduce((s: number, p: any) => s + (p.text || '').length, 0);
        const map = new Map<number, string>();
        for (const line of (r.text || '').split('\n')) {
          const mm = line.match(/^\s*\[(\d+)\]\s*(.+)$/);
          if (mm) map.set(parseInt(mm[1], 10), mm[2].trim());
        }
        for (let i = batch.start; i <= batch.end; i++) {
          const tr = map.get(i + 1);
          if (tr) translations[i] = tr;
        }
      } else {
        for (let i = batch.start; i <= batch.end; i++) translations[i] = limited[i].text;
      }
    }

    const actualCredits = await estimateByChars(FEATURES.DOC, okChars);
    const settled = await endSyncSuccess({ userId: auth.userId, jobId, usageId: begin.usageId, estimated: begin.estimated, actualCredits });
    if (!settled.ok) return NextResponse.json({ ok: false, error: settled.error }, { status: 500 });

    return NextResponse.json({
      ok: true,
      format,
      fileName: file.name,
      paragraphs: limited.map(p => ({ kind: p.kind, source: p.source, text: p.text })),
      translations,
      total: limited.length,
      credits: settled ? settled.consumed : undefined,
    });
  } catch (e: any) {
    if (creditCtx) await endSyncFail({ userId: creditCtx.userId, jobId: creditCtx.jobId, usageId: creditCtx.usageId, estimated: creditCtx.estimated });
    console.error('[doc/translate]', e?.message || e);
    return NextResponse.json({ ok: false, error: '服务器繁忙，请稍后再试。' }, { status: 500 });
  }
}
