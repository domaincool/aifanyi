/**
 * PDF 翻译执行器（阶段 2）
 * 后台处理 queued Job：组级翻译（同页 3-5 block 合并）→ DeepSeek 主/GLM 备 → 进度回写 → 汇总
 * 并发 ≤3；单组失败重试 1 次后降级 GLM；部分失败任务仍 completed（stats 标记）
 */
import { DeepSeekProvider } from '../translator/providers/deepseek';
import { GlmProvider } from '../translator/providers/glm';
import { hashText, getCache, setCache } from '../translator/cache';
import { buildPdfGroupPrompt, PDF_CONFIG } from './config';
import { PdfBlock, PdfDocument, PdfTranslation, TranslationGroup } from './types';
import { prisma } from '../db';
import { endSyncSuccess, endSyncFail } from '../credit/sync-settle';

const deepseek = new DeepSeekProvider();
const glm = new GlmProvider();

let runningJobs = 0;
const MAX_CONCURRENT = PDF_CONFIG.quota.maxConcurrent;

/** 后台执行入口（fire-and-forget） */
export function startPdfJob(taskId: string): void {
  // 并发控制：满则 2s 后重试（P1 简单等待，最多等 10 次）
  const tryStart = (attempt: number) => {
    if (runningJobs < MAX_CONCURRENT) {
      runningJobs++;
      void processJob(taskId).finally(() => { runningJobs--; });
    } else if (attempt < 10) {
      setTimeout(() => tryStart(attempt + 1), 2000);
    } else {
      console.error(`[pdf-job] ${taskId} 并发等待超时`);
    }
  };
  tryStart(0);
}

async function processJob(taskId: string): Promise<void> {
  const started = Date.now();
  let job: any;
  try {
    job = await prisma.pdfJob.findUnique({ where: { taskId } });
    if (!job || job.status !== 'queued') return;
    const doc = job.document as unknown as PdfDocument;
    if (!doc) throw new Error('document 为空');

    await prisma.pdfJob.update({ where: { taskId }, data: { status: 'processing' } });

    let totalInput = 0, totalOutput = 0, totalCost = 0, apiErrors = 0, translatedBlocks = 0;
    const totalBlocks = doc.pages.reduce((s: number, p: any) => s + p.blocks.length, 0);

    for (const page of doc.pages) {
      // 取消检查：已取消则立即停止（不结算，取消时已退回）
      const curJob = await prisma.pdfJob.findUnique({ where: { taskId }, select: { status: true } });
      if (curJob?.status === 'cancelled') return;
      // 跳过 header/footer/image（不翻译，保留原文）
      const translatable = page.blocks.filter((b: PdfBlock) => b.type !== 'header' && b.type !== 'footer' && b.type !== 'image');
      const groups = buildGroups(page.pageNumber, translatable);

      for (const g of groups) {
        const result = await translateGroup(g, doc.sourceLang, doc.targetLang);
        totalInput += result.inputTokens;
        totalOutput += result.outputTokens;
        totalCost += result.costUsd;
        if (result.apiErrors) apiErrors += result.apiErrors;
        // 回填 translations
        for (let i = 0; i < g.blockIds.length; i++) {
          const blk = findBlock(doc, g.pageNumber, g.blockIds[i]);
          if (!blk) continue;
          const segText = result.segments[i];
          if (segText) {
            blk.translations['deepseek'] = {
              text: segText, model: result.model, promptTokens: 0, completionTokens: 0,
              costUsd: 0, latencyMs: result.latencyMs,
            };
            translatedBlocks++;
          }
        }
        // 每组合计延迟展示用；组间小睡防限流
        await sleep(150);
      }

      // 进度回写
      await prisma.pdfJob.update({
        where: { taskId },
        data: {
          progress: Math.round((page.pageNumber / doc.pageCount) * 100),
          currentPage: page.pageNumber,
          translatedBlocks,
          totalInputTokens: totalInput,
          totalOutputTokens: totalOutput,
          totalCostUsd: Math.round(totalCost * 1e6) / 1e6,
          apiErrorCount: apiErrors,
        },
      });
    }

    // 完成：部分失败也 completed（stats.failedBlocks 标识）
    // 结构性块（header/footer/image）不参与翻译，不计入失败分母
    const translatableBlocks = doc.pages.reduce(
      (s: number, p: any) => s + p.blocks.filter((b: PdfBlock) => b.type !== 'header' && b.type !== 'footer' && b.type !== 'image').length,
      0
    );
    const failedBlocks = translatableBlocks - translatedBlocks;

    // 额度结算：按成功翻译块比例 consume，差额退回；全失败全退
    if (job.userId) {
      const usage = await prisma.usageRecord.findFirst({ where: { jobId: taskId }, select: { id: true } });
      const est = job.reservedCredits || 0;
      if (usage && est > 0) {
        const actual = translatableBlocks > 0 ? Math.round((translatedBlocks / translatableBlocks) * est) : 0;
        await endSyncSuccess({ userId: job.userId, jobId: taskId, usageId: usage.id, estimated: est, actualCredits: actual });
      }
    }

    await prisma.pdfJob.update({
      where: { taskId },
      data: {
        status: 'completed',
        progress: 100,
        document: doc as unknown as object,
        durationMs: Date.now() - started,
        totalInputTokens: totalInput,
        totalOutputTokens: totalOutput,
        totalCostUsd: Math.round(totalCost * 1e6) / 1e6,
        apiErrorCount: apiErrors,
        errorType: failedBlocks > 0 ? 'partial_translation_failed' : null,
        errorMessage: failedBlocks > 0 ? `部分内容翻译失败（${failedBlocks}/${translatableBlocks} 可翻译块），可重新翻译失败部分。` : null,
      },
    });
    console.log(`[pdf-job] ${taskId} 完成: ${translatedBlocks}/${totalBlocks} 块, ¥${(totalCost * 7.2).toFixed(3)}, ${Date.now() - started}ms`);
  } catch (e: any) {
    console.error(`[pdf-job] ${taskId} 失败:`, e?.message);
    // 额度：失败全退
    if (job?.userId) {
      const usage = await prisma.usageRecord.findFirst({ where: { jobId: taskId }, select: { id: true } });
      if (usage && (job?.reservedCredits || 0) > 0) {
        await endSyncFail({ userId: job.userId, jobId: taskId, usageId: usage.id, estimated: job.reservedCredits });
      }
    }
    await prisma.pdfJob.update({
      where: { taskId },
      data: {
        status: 'failed',
        errorType: 'translation_failed',
        errorMessage: '翻译过程中出现错误，请稍后重试。',
        durationMs: Date.now() - started,
      },
    }).catch(() => {});
  }
}

interface GroupResult {
  model: string;
  segments: (string | undefined)[];
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  apiErrors: number;
}

/** 翻译一个组：缓存 → DeepSeek（重试1次）→ GLM 降级 */
async function translateGroup(g: TranslationGroup, sourceLang: string, targetLang: string): Promise<GroupResult> {
  const key = hashText(g.sourceText, sourceLang, targetLang, 'pdf', 'deepseek', String(PDF_CONFIG.promptVersion));
  const hit = getCache(key);
  if (hit) {
    return { model: `cache:${hit.model}`, segments: splitSegments(hit.result, g.blockIds.length), inputTokens: 0, outputTokens: 0, costUsd: 0, latencyMs: 0, apiErrors: 0 };
  }

  const prompt = buildPdfGroupPrompt(sourceLang, targetLang);
  const input = `${prompt}\n\n${g.sourceText}`;
  // 60s 超时（provider_timeout）——provider 内部 fetch 无超时，这里包一层 AbortController 不可行（provider 不接收 signal），
  // 改为 Promise.race 超时保护；429 识别降级
  const attempt = async (provider: DeepSeekProvider | GlmProvider, model: string): Promise<{ r: any; timedOut: boolean; rateLimited: boolean }> => {
    const timer = new Promise<null>((res) => setTimeout(() => res(null), 60000));
    const call = provider.translate({ text: input, sourceLang, targetLang, scenario: 'pdf', maxTokens: 4096 });
    const r = await Promise.race([call, timer]);
    if (r === null) return { r: null, timedOut: true, rateLimited: false };
    const rr = r as any;
    const rateLimited = !!(rr.error && (/429|rate limit|too many requests/i.test(rr.error)));
    return { r: rr, timedOut: false, rateLimited };
  };

  // DeepSeek 主，失败重试 1 次（429 等待 1s 重试）
  let a = await attempt(deepseek, 'deepseek');
  if (a.timedOut) await sleep(500);
  if (!a.r || a.r.error || !a.r.text) {
    if (a.rateLimited) await sleep(1000);
    a = await attempt(deepseek, 'deepseek');
  }
  let r = a.r;
  let model = 'deepseek';
  let timedOut = a.timedOut;
  if (!r || r.error || !r.text) {
    // GLM 降级
    const a2 = await attempt(glm, 'glm');
    if (!a2.r || a2.r.error || !a2.r.text) {
      const tokIn = (r?.promptTokens || 0) + (a2.r?.promptTokens || 0);
      const tokOut = (r?.completionTokens || 0) + (a2.r?.completionTokens || 0);
      const cost = (r?.costUsd || 0) + (a2.r?.costUsd || 0);
      return { model: 'none', segments: [], inputTokens: tokIn, outputTokens: tokOut, costUsd: cost, latencyMs: 0, apiErrors: 2 };
    }
    r = a2.r; model = 'glm'; timedOut = a2.timedOut;
  }
  if (r && !r.error && r.text) {
    setCache(key, r.text, model);
  }
  return {
    model,
    segments: r && r.text ? splitSegments(r.text, g.blockIds.length) : [],
    inputTokens: r?.promptTokens || 0,
    outputTokens: r?.completionTokens || 0,
    costUsd: r?.costUsd || 0,
    latencyMs: r?.latencyMs || 0,
    apiErrors: (r?.error || timedOut) ? 1 : 0,
  };
}

/** 按 [SEG n] 标记拆分模型输出 */
function splitSegments(text: string, count: number): (string | undefined)[] {
  const parts = text.split(/\[SEG\s+\d+\]/).map((s) => s.trim()).filter((s) => s.length > 0);
  const segs: (string | undefined)[] = [];
  for (let i = 0; i < count; i++) segs.push(parts[i] || undefined);
  return segs;
}

/** 同页 3-5 块一组 */
function buildGroups(pageNumber: number, blocks: PdfBlock[]): TranslationGroup[] {
  const groups: TranslationGroup[] = [];
  const size = Math.min(Math.max(PDF_CONFIG.groupSize, 3), 5);
  for (let i = 0; i < blocks.length; i += size) {
    const chunk = blocks.slice(i, i + size);
    groups.push({
      groupId: `${pageNumber}-${i}`,
      pageNumber,
      blockIds: chunk.map((b) => b.id),
      sourceText: chunk.map((b, idx) => `[SEG ${idx + 1}] ${b.text}`).join('\n'),
      translatedText: '',
    });
  }
  return groups;
}

function findBlock(doc: PdfDocument, pageNumber: number, blockId: string): PdfBlock | undefined {
  const page = doc.pages.find((p) => p.pageNumber === pageNumber);
  return page?.blocks.find((b) => b.id === blockId);
}

function sleep(ms: number): Promise<void> { return new Promise((res) => setTimeout(res, ms)); }
