/**
 * Credit 扫描器（服务器 crontab 每 30 分钟）
 * 1. 超时未结算任务强制结算（creditState=reserved 且 createdAt > 1h）
 *    - completed → 按成功比例 consume
 *    - failed/cancelled → 全退
 *    - queued/processing 卡死 → 标记 failed + 全退
 * 2. 过期 Grant 到期（expireCredits）
 * 3. 对账：available+reserved vs ΣLedger，mismatch 写 ReconciliationRecord（不静默修复）
 */
import { prisma } from '../src/lib/db';
import { endSyncSuccess, endSyncFail } from '../src/lib/credit/sync-settle';
import { expireCredits } from '../src/lib/credit/engine';

async function settleStuckJobs(): Promise<{ settled: number; released: number; consumed: number }> {
  const cutoff = new Date(Date.now() - 3600_000); // 1h
  let settled = 0, released = 0, consumed = 0;

  // ── PDF ──
  const pdfJobs = await prisma.pdfJob.findMany({
    where: { creditState: 'reserved', createdAt: { lt: cutoff } },
    select: { taskId: true, userId: true, status: true, reservedCredits: true, document: true, translatedBlocks: true },
  });
  for (const job of pdfJobs) {
    const usage = await prisma.usageRecord.findFirst({ where: { jobId: job.taskId }, select: { id: true } });
    const est = job.reservedCredits || 0;
    if (!job.userId || !usage || est <= 0) { await prisma.pdfJob.update({ where: { taskId: job.taskId }, data: { creditState: 'credit_skipped' } }); continue; }

    if (job.status === 'completed') {
      const doc = job.document as any;
      const translatable = doc?.pages?.reduce((s: number, p: any) => s + (p.blocks || []).filter((b: any) => b.type !== 'header' && b.type !== 'footer' && b.type !== 'image').length, 0) || 0;
      const translated = job.translatedBlocks || 0;
      const actual = translatable > 0 ? Math.round((translated / translatable) * est) : 0;
      await endSyncSuccess({ userId: job.userId, jobId: job.taskId, usageId: usage.id, estimated: est, actualCredits: actual });
      consumed += actual; released += est - actual;
    } else {
      await endSyncFail({ userId: job.userId, jobId: job.taskId, usageId: usage.id, estimated: est });
      released += est;
      if (job.status === 'queued' || job.status === 'processing') {
        await prisma.pdfJob.update({ where: { taskId: job.taskId }, data: { status: 'failed', errorType: 'credit_timeout', errorMessage: '任务超时未完成，已自动取消并退回额度。' } });
      }
    }
    settled++;
  }

  // ── 字幕 ──
  const subJobs = await prisma.subtitleJob.findMany({
    where: { creditState: 'reserved', createdAt: { lt: cutoff } },
    select: { taskId: true, userId: true, status: true, reservedCredits: true, translatedCues: true, totalCues: true },
  });
  for (const job of subJobs) {
    const usage = await prisma.usageRecord.findFirst({ where: { jobId: job.taskId }, select: { id: true } });
    const est = job.reservedCredits || 0;
    if (!job.userId || !usage || est <= 0) { await prisma.subtitleJob.update({ where: { taskId: job.taskId }, data: { creditState: 'credit_skipped' } }); continue; }

    if (job.status === 'completed') {
      const total = job.totalCues || 0;
      const translated = job.translatedCues || 0;
      const actual = total > 0 ? Math.round((translated / total) * est) : 0;
      await endSyncSuccess({ userId: job.userId, jobId: job.taskId, usageId: usage.id, estimated: est, actualCredits: actual });
      consumed += actual; released += est - actual;
    } else {
      await endSyncFail({ userId: job.userId, jobId: job.taskId, usageId: usage.id, estimated: est });
      released += est;
      if (job.status === 'queued' || job.status === 'processing') {
        await prisma.subtitleJob.update({ where: { taskId: job.taskId }, data: { status: 'failed', errorType: 'credit_timeout', errorMessage: '任务超时未完成，已自动取消并退回额度。' } });
      }
    }
    settled++;
  }

  return { settled, released, consumed };
}

async function reconcile(): Promise<{ mismatches: number }> {
  // 全量对账：available+reserved vs ΣLedger
  const rows: any[] = await prisma.$queryRaw`
    SELECT a."userId", (a.balance + a."reservedBalance") AS total, COALESCE(SUM(l.amount), 0) AS ledger
    FROM "CreditAccount" a
    LEFT JOIN "CreditLedger" l ON l."userId" = a."userId"
    GROUP BY a."userId", a.balance, a."reservedBalance"
    HAVING (a.balance + a."reservedBalance") != COALESCE(SUM(l.amount), 0)
  `;
  let mismatches = 0;
  for (const r of rows) {
    // 已记录 open 状态的不重复写
    const existing = await prisma.reconciliationRecord.findFirst({
      where: { userId: r.userId, checkType: 'balance_vs_ledger', status: 'open' },
    });
    if (!existing) {
      await prisma.reconciliationRecord.create({
        data: {
          checkType: 'balance_vs_ledger',
          userId: r.userId,
          expected: r.total,
          actual: r.ledger,
          diff: r.total - r.ledger,
          detail: '扫描器全量对账',
          status: 'open',
        },
      });
    }
    mismatches++;
  }
  return { mismatches };
}

async function main() {
  const started = Date.now();
  const stuck = await settleStuckJobs();
  const exp = await expireCredits();
  const rec = await reconcile();
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    stuck,
    expired: exp,
    reconcile: rec,
    ms: Date.now() - started,
  }));
}

main().catch((e) => { console.error('[credit-reconciler]', e); process.exit(1); });
