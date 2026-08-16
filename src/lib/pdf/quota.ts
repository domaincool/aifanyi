/**
 * PDF 免费积分：游客/登录用户差异化，配置化
 * 游客：1 文件/日 / 10 页/日
 * 登录：5 文件/日 / 50 页/日
 * 防滥用维度：clientKey（IP+UA 哈希）
 */
import { prisma } from '../db';
import { beijingDayStart } from '../time-beijing';
import { PDF_CONFIG } from './config';

export async function checkPdfQuota(
  clientKey: string,
  pageCount: number,
  userId: string | null,
  guestSessionId: string | null
): Promise<{ ok: boolean; reason?: string }> {
  const todayStart = beijingDayStart();

  const isGuest = !userId && !!guestSessionId;
  const dailyFiles = isGuest ? (PDF_CONFIG.quota as any).guestDailyFiles || 1 : PDF_CONFIG.quota.dailyFiles;
  const dailyPages = isGuest ? (PDF_CONFIG.quota as any).guestDailyPages || 10 : PDF_CONFIG.quota.dailyPages;

  // 登录用户：按 userId 统计
  const where: any = { createdAt: { gte: todayStart } };
  if (userId) {
    where.userId = userId;
  } else {
    where.guestSessionId = guestSessionId;
  }

  const [filesToday, pagesAgg] = await Promise.all([
    prisma.pdfJob.count({ where }),
    prisma.pdfJob.aggregate({ where, _sum: { pageCount: true } }),
  ]);
  const pagesToday = pagesAgg._sum.pageCount || 0;

  if (filesToday >= dailyFiles) {
    return { ok: false, reason: `今日免费积分已用完（${filesToday}/${dailyFiles} 个文件）。${isGuest ? '登录后可获得更多积分。' : '明天自动恢复。'}` };
  }
  if (pagesToday + pageCount > dailyPages) {
    return { ok: false, reason: `今日剩余页数不足（已用 ${pagesToday}/${dailyPages} 页，本次需 ${pageCount} 页）。` };
  }
  return { ok: true };
}

export async function checkGlobalDailyCap(): Promise<boolean> {
  const todayStart = beijingDayStart();
  const count = await prisma.pdfJob.count({ where: { createdAt: { gte: todayStart } } });
  const cap = Number(process.env.PDF_GLOBAL_DAILY_CAP || 200);
  return count < cap;
}