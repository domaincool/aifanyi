import { prisma } from '@/lib/db';
import { DeepSeekProvider } from '@/lib/translator/providers/deepseek';
import { GlmProvider } from '@/lib/translator/providers/glm';
import { SubtitleCue } from '@/lib/subtitle-lib';

/**
 * 字幕翻译后台 Job
 * 分批（≤20 条 / ≤1500 字符）→ DeepSeek 主（60s 超时保护 + 429 识别，重试 1 次后降级 GLM）→ 进度回写
 */

const deepseek = new DeepSeekProvider();
const glm = new GlmProvider();

const BATCH_SIZE = 20;
const BATCH_MAX_CHARS = 1500;

export async function runSubtitleJob(taskId: string): Promise<void> {
  const startedAt = Date.now();
  let job = await prisma.subtitleJob.findUnique({ where: { taskId } });
  if (!job) return;

  try {
    const doc = (job.document as any) || {};
    const cues: SubtitleCue[] = (doc.cues || []) as SubtitleCue[];
    if (cues.length === 0) throw new Error('empty cues');

    // 分批
    const batches: { items: SubtitleCue[]; content: string }[] = [];
    let current: SubtitleCue[] = [];
    let currentText = '';
    for (const cue of cues) {
      const addText = `[${cue.index}] ${cue.text}`;
      if (current.length >= BATCH_SIZE || (currentText.length + addText.length > BATCH_MAX_CHARS && current.length > 0)) {
        batches.push({ items: current, content: currentText.trim() });
        current = []; currentText = '';
      }
      current.push(cue);
      currentText += addText + '\n';
    }
    if (current.length) batches.push({ items: current, content: currentText.trim() });

    const targetLabel = job.targetLang === 'zh' ? '简体中文' : job.targetLang;
    let translated = 0;
    let totalIn = 0, totalOut = 0, totalCost = 0;
    let apiErrors = 0;

    for (const batch of batches) {
      const prompt = `你是专业字幕翻译。把下面的字幕逐条翻译成${targetLabel}。\n要求：\n1. 逐条翻译，输出格式固定为 [序号] 译文，一行一条，序号必须与输入一致\n2. 口语化、贴合语境，译文长度适中（不要明显长于原文）\n3. 人名/品牌名保留原文或使用通用译法，不要加解释\n\n字幕内容：\n${batch.content}`;

      // 60s 超时保护（同 PDF translate.ts 模式）
      const attempt = async (provider: DeepSeekProvider | GlmProvider, model: string): Promise<{ r: any; timedOut: boolean; rateLimited: boolean }> => {
        const timer = new Promise<null>((res) => setTimeout(() => res(null), 60000));
        const call = provider.translate({ text: prompt, sourceLang: 'auto', targetLang: job.targetLang, scenario: 'subtitle', maxTokens: 4096 });
        const r = await Promise.race([call, timer]);
        if (r === null) return { r: null, timedOut: true, rateLimited: false };
        const rr = r as any;
        const rateLimited = !!(rr.error && (/429|rate limit|too many requests/i.test(rr.error)));
        return { r: rr, timedOut: false, rateLimited };
      };

      let ok = false;
      let lastErr: string | null = null;
      // 主 DeepSeek：重试 1 次（超时/429/错误）→ 降级 GLM
      for (let attemptNo = 0; attemptNo < 2 && !ok; attemptNo++) {
        const provider = attemptNo === 0 ? deepseek : glm;
        const { r, timedOut, rateLimited } = await attempt(provider, attemptNo === 0 ? 'deepseek' : 'glm');
        if (r && !r.error) {
          totalIn += r.promptTokens || 0;
          totalOut += r.completionTokens || 0;
          totalCost += r.costUsd || 0;
          // 解析 [n] 译文
          const lines = (r.text || '').split('\n');
          const map = new Map<number, string>();
          for (const line of lines) {
            const mm = line.match(/^\s*\[(\d+)\]\s*(.+)$/);
            if (mm) map.set(parseInt(mm[1], 10), mm[2].trim());
          }
          let batchTranslated = 0;
          for (const item of batch.items) {
            const tr = map.get(item.index);
            if (tr) { (item as any).translation = tr; batchTranslated++; }
          }
          translated += batchTranslated;
          if (batchTranslated === 0) { lastErr = '解析失败：模型输出未匹配序号'; apiErrors++; }
          ok = true;
        } else {
          lastErr = r?.error || (timedOut ? 'provider_timeout' : rateLimited ? 'provider_rate_limit' : 'provider_error');
          apiErrors++;
        }
      }
      if (!ok && lastErr) {
        for (const item of batch.items) (item as any).translation = item.text; // 失败保留原文
      }

      // 回写进度
      await prisma.subtitleJob.update({
        where: { taskId },
        data: {
          progress: Math.min(99, Math.round((translated / cues.length) * 100)),
          translatedCues: translated,
          totalInputTokens: totalIn,
          totalOutputTokens: totalOut,
          totalCostUsd: totalCost,
          apiErrorCount: apiErrors,
        },
      });
    }

    const failedBatches = apiErrors > batches.length ? apiErrors - batches.length : 0;
    const errorType = failedBatches > 0 ? 'subtitle_partial_failed' : undefined;
    await prisma.subtitleJob.update({
      where: { taskId },
      data: {
        status: 'completed',
        progress: 100,
        translatedCues: translated,
        durationMs: Date.now() - startedAt,
        completedAt: new Date(),
        document: { cues: cues.map(c => ({ index: c.index, start: c.start, end: c.end, text: c.text, translation: (c as any).translation })) },
        errorType,
      },
    });
  } catch (e: any) {
    console.error('[subtitle-job]', taskId, e?.message || e);
    await prisma.subtitleJob.update({
      where: { taskId },
      data: { status: 'failed', errorType: 'subtitle_job_error', errorMessage: String(e?.message || e).slice(0, 500) },
    });
  }
}

/** 每日额度校验（同 PDF：5 文件/日/IP+UA） */
export async function checkSubtitleQuota(clientKey: string): Promise<{ ok: boolean; used: number; limit: number }> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const count = await prisma.subtitleJob.count({ where: { clientKey, createdAt: { gte: start } } });
  return { ok: count < 5, used: count, limit: 5 };
}
