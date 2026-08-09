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
    const failedBlocks = totalBlocks - translatedBlocks;
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
        errorMessage: failedBlocks > 0 ? `部分内容翻译失败（${failedBlocks}/${totalBlocks} 块），可重新翻译失败部分。` : null,
      },
    });
    console.log(`[pdf-job] ${taskId} 完成: ${translatedBlocks}/${totalBlocks} 块, ¥${(totalCost * 7.2).toFixed(3)}, ${Date.now() - started}ms`);
  } catch (e: any) {
    console.error(`[pdf-job] ${taskId} 失败:`, e?.message);
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
  const attempt = async (provider: DeepSeekProvider | GlmProvider, model: string) => {
    const r = await provider.translate({ text: input, sourceLang, targetLang, scenario: 'pdf', maxTokens: 4096 });
    return r;
  };

  // DeepSeek 主，失败重试 1 次
  let r = await attempt(deepseek, 'deepseek');
  if (r.error || !r.text) r = await attempt(deepseek, 'deepseek');
  let model = 'deepseek';
  if (r.error || !r.text) {
    // GLM 降级
    const r2 = await attempt(glm, 'glm');
    if (r2.error || !r2.text) {
      return { model: 'none', segments: [], inputTokens: r.promptTokens + r2.promptTokens, outputTokens: r.completionTokens + r2.completionTokens, costUsd: r.costUsd + r2.costUsd, latencyMs: 0, apiErrors: 2 };
    }
    r = r2; model = 'glm';
  }
  if (!r.error && r.text) {
    setCache(key, r.text, model);
  }
  return {
    model,
    segments: splitSegments(r.text, g.blockIds.length),
    inputTokens: r.promptTokens,
    outputTokens: r.completionTokens,
    costUsd: r.costUsd,
    latencyMs: r.latencyMs,
    apiErrors: r.error ? 1 : 0,
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
