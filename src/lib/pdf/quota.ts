/**
 * PDF 免费额度（规格 11）：5 文件/日 且 50 页/日（先到为准）；对比 20 段/日（阶段 4 用）
 * 防滥用维度：clientKey（IP+UA 哈希），不只看 IP
 */
import { prisma } from '../db';
import { PDF_CONFIG } from './config';

export async function checkPdfQuota(clientKey: string, pageCount: number): Promise<{ ok: boolean; reason?: string }> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const jobs = await prisma.pdfJob.findMany({
    where: { clientKey, createdAt: { gte: todayStart } },
    select: { pageCount: true },
  });
  const filesToday = jobs.length;
  const pagesToday = jobs.reduce((s, j) => s + j.pageCount, 0);
  const q = PDF_CONFIG.quota;
  if (filesToday >= q.dailyFiles) {
    return { ok: false, reason: `今日免费额度已用完（${filesToday}/${q.dailyFiles} 个文件）。明天再来或更换网络后重试。` };
  }
  if (pagesToday + pageCount > q.dailyPages) {
    return { ok: false, reason: `今日剩余页数不足（已用 ${pagesToday}/${q.dailyPages} 页，本次需 ${pageCount} 页）。` };
  }
  return { ok: true };
}

/** 全站日熔断（规格 11 后台）：全局每日 PDF 任务上限，防滥用兜底 */
export async function checkGlobalDailyCap(): Promise<boolean> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const count = await prisma.pdfJob.count({ where: { createdAt: { gte: todayStart } } });
  const cap = Number(process.env.PDF_GLOBAL_DAILY_CAP || 200);
  return count < cap;
}
