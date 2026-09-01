/**
 * 公平使用制 · 双阈值限额（B2，2026-09-01 用户拍板）
 *
 * 游客（clientKey）：日 5 文件 / 50 页
 * 登录用户：日 10 文件 / 100 页（硬阈值，拍板）
 * 登录软阈值：日 5 文件 / 50 页（= 游客线，仅打点观察名单，用户无感）
 *
 * - 阈值全部 env 可配（不硬编码）：FAIR_USE_GUEST_FILES / FAIR_USE_GUEST_PAGES /
 *   FAIR_USE_LOGIN_FILES / FAIR_USE_LOGIN_PAGES / FAIR_USE_SOFT_FILES / FAIR_USE_SOFT_PAGES
 * - 硬阈值超限返回语义化错误码 fair_use_limit_reached（前端据此渲染「公平使用」文案，
 *   不用「积分不足」）
 * - 软阈值仅落库打点（UsageLedger type=fair_use_soft），供 D2 观察名单导出
 * - clientKey 日 200 全站熔断（checkGlobalDailyCap）继续兜底，本模块不管
 */
import { prisma } from './db';
import { beijingDayStart } from './time-beijing';

/** 阈值（env 可配，默认按用户拍板值） */
export const FAIR_USE = {
  guestFiles: Number(process.env.FAIR_USE_GUEST_FILES || 5),
  guestPages: Number(process.env.FAIR_USE_GUEST_PAGES || 50),
  loginFiles: Number(process.env.FAIR_USE_LOGIN_FILES || 10),
  loginPages: Number(process.env.FAIR_USE_LOGIN_PAGES || 100),
  softFiles: Number(process.env.FAIR_USE_SOFT_FILES || 5),
  softPages: Number(process.env.FAIR_USE_SOFT_PAGES || 50),
};

export const FAIR_USE_CODE = 'fair_use_limit_reached';

/** 触线文案（前端渲染用；登录/游客分版） */
export const FAIR_USE_MESSAGES = {
  login: '为保障所有人稳定使用，今日已达公平使用上限，明日自动恢复。',
  guest: '今日免费额度已用完，免费注册即可解锁双倍每日额度。',
};

export type FairUseResult =
  | { ok: true; softHit: boolean; filesToday: number; pagesToday: number }
  | { ok: false; code: string; message: string; filesToday: number; pagesToday: number };

/**
 * 统计某维度（userId 或 clientKey）今日已用文件数 / PDF 页数
 * 文件口径：PdfJob + SubtitleJob + UsageLedger(image/doc/web) 当日计数
 * 页数口径：PdfJob 当日 pageCount 之和
 */
export async function dailyUsage(dim: { userId?: string | null; clientKey?: string | null }): Promise<{ files: number; pages: number }> {
  const todayStart = beijingDayStart();
  const where: any = { createdAt: { gte: todayStart } };
  if (dim.userId) where.userId = dim.userId;
  else if (dim.clientKey) where.clientKey = dim.clientKey;

  const [pdfCount, subCount, pdfPages] = await Promise.all([
    prisma.pdfJob.count({ where }),
    prisma.subtitleJob.count({ where }),
    prisma.pdfJob.aggregate({ where, _sum: { pageCount: true } }),
  ]);

  // 同步工具（image/doc/web）计数：UsageLedger 当日行数（feature 前缀匹配）
  const ledgerTypes = ['image_translation', 'doc_translation', 'web_translation'];
  const ledgerWhere: any = { createdAt: { gte: todayStart }, type: { in: ledgerTypes } };
  if (dim.userId) ledgerWhere.userId = dim.userId;
  const ledgerCount = await prisma.usageLedger.count({ where: ledgerWhere });

  return { files: pdfCount + subCount + ledgerCount, pages: pdfPages._sum.pageCount || 0 };
}

/**
 * B2 双阈值检查。返回 ok:false 时携带语义化错误码 fair_use_limit_reached。
 * - 登录用户：硬阈值 10/100 → 拒绝；软阈值 5/50 → 打点（不拒绝）
 * - 游客（clientKey）：5/50 → 拒绝
 * @param pages 本次任务页数（PDF 用；非 PDF 传 0）
 */
export async function checkFairUse(input: {
  userId?: string | null;
  clientKey?: string | null;
  pages?: number;
}): Promise<FairUseResult> {
  const { files, pages } = await dailyUsage({ userId: input.userId, clientKey: input.clientKey });
  const thisPages = input.pages || 0;
  const isGuest = !input.userId;

  if (isGuest) {
    if (files >= FAIR_USE.guestFiles || pages + thisPages > FAIR_USE.guestPages) {
      return { ok: false, code: FAIR_USE_CODE, message: FAIR_USE_MESSAGES.guest, filesToday: files, pagesToday: pages };
    }
    return { ok: true, softHit: false, filesToday: files, pagesToday: pages };
  }

  // 登录：硬阈值
  if (files >= FAIR_USE.loginFiles || pages + thisPages > FAIR_USE.loginPages) {
    return { ok: false, code: FAIR_USE_CODE, message: FAIR_USE_MESSAGES.login, filesToday: files, pagesToday: pages };
  }

  // 登录：软阈值 → 仅打点（观察名单），不拒绝
  let softHit = false;
  if (files >= FAIR_USE.softFiles || pages >= FAIR_USE.softPages) {
    softHit = true;
    await prisma.usageLedger.create({
      data: {
        userId: input.userId!,
        type: 'fair_use_soft',
        amount: 1,
        unit: 'hit',
        description: `软阈值命中：今日 ${files} 文件 / ${pages} 页（${FAIR_USE.softFiles}/${FAIR_USE.softPages}）`,
      },
    }).catch((e: any) => console.error('[fairuse] soft mark:', e?.message));
  }

  return { ok: true, softHit, filesToday: files, pagesToday: pages };
}

/** D2 观察名单：软阈值以上用户清单 + 日用量（运营周报用） */
export async function fairUseWatchlist(): Promise<{
  users: { userId: string; email?: string | null; files: number; pages: number; softFiles: number; softPages: number }[];
}> {
  const todayStart = beijingDayStart();
  const where: any = { createdAt: { gte: todayStart }, userId: { not: null } };
  const [pdfs, subs] = await Promise.all([
    prisma.pdfJob.groupBy({ by: ['userId'], where: { userId: { not: null }, createdAt: { gte: todayStart } }, _count: { _all: true }, _sum: { pageCount: true } }),
    prisma.subtitleJob.groupBy({ by: ['userId'], where: { userId: { not: null }, createdAt: { gte: todayStart } }, _count: { _all: true } }),
  ]);
  const ledgerWhere: any = { createdAt: { gte: todayStart }, userId: { not: null }, type: { in: ['image_translation', 'doc_translation', 'web_translation'] } };
  const ledgers = await prisma.usageLedger.groupBy({ by: ['userId'], where: ledgerWhere, _count: { _all: true } });

  const agg = new Map<string, { files: number; pages: number }>();
  for (const r of pdfs) {
    if (!r.userId) continue;
    const u = r.userId as string;
    const cur = agg.get(u) || { files: 0, pages: 0 };
    cur.files += r._count._all;
    cur.pages += r._sum.pageCount || 0;
    agg.set(u, cur);
  }
  for (const r of subs) {
    const u = r.userId as string;
    const cur = agg.get(u) || { files: 0, pages: 0 };
    cur.files += r._count._all;
    agg.set(u, cur);
  }
  for (const r of ledgers) {
    const u = r.userId as string;
    const cur = agg.get(u) || { files: 0, pages: 0 };
    cur.files += r._count._all;
    agg.set(u, cur);
  }

  const overSoft = [...agg.entries()]
    .filter(([, v]) => v.files >= FAIR_USE.softFiles || v.pages >= FAIR_USE.softPages)
    .map(([userId, v]) => ({ userId, files: v.files, pages: v.pages, softFiles: FAIR_USE.softFiles, softPages: FAIR_USE.softPages, email: null as string | null }))
    .sort((a, b) => b.files - a.files);

  // 补邮箱（观察名单可读性）
  if (overSoft.length) {
    const users = await prisma.user.findMany({ where: { id: { in: overSoft.map((u) => u.userId) } }, select: { id: true, email: true } });
    const emailMap = new Map(users.map((u) => [u.id, u.email]));
    for (const row of overSoft) row.email = emailMap.get(row.userId) ?? null;
  }

  return { users: overSoft };
}
