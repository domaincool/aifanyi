/**
 * 每日对账全量快照（V1.2 P1-A-4b）
 *
 * 由 scripts/credit-reconciler.ts 在每次对账后调用（patch 由 reconciler-patch.ts 打入）。
 * 除 mismatch 外，把全量快照（各表计数 + 余额合计 + Ledger SUM + 当日新增 grant/consume/refund
 * + 订单到账情况）落盘为 JSON 文件，供运营/主线程每日核对「系统总量状态」。
 *
 * 落盘位置（二选一）：
 *   1. 环境变量 RECONCILE_SNAPSHOT_DIR=/path/to/dir（推荐；服务器建议 /opt/aifanyi/data/reconcile）
 *   2. 未设置 → <repo>/data/reconcile/（本地开发默认；建议把 data/ 加入 .gitignore）
 *
 * 文件：
 *   - reconcile-YYYY-MM-DD.json  当日快照（同日内重跑覆盖，保持「每日」粒度）
 *   - latest.json                始终指向最近一次快照（便于脚本/看板读取）
 *   - 自动清理 30 天前的 reconcile-*.json
 *
 * 时区：dayStart 用进程本地时间（服务器为 Asia/Shanghai），文件名与 daily.date 均为本地日期。
 * 失败不抛：writeDailySnapshot 内部 catch，返回 { ok:false, error }，不阻塞 reconciler 主流程。
 */
import fs from 'fs';
import path from 'path';
import { prisma } from '../src/lib/db';

export interface ReconcilerRunContext {
  ts: string;
  stuck: { settled: number; released: number; consumed: number };
  expired: { expired: number; freed: number };
  reconcile: { mismatches: number };
  ms: number;
}

export interface DailySnapshot {
  ts: string;
  day: string; // YYYY-MM-DD（进程本地时区）
  source: 'credit-reconciler';
  run: ReconcilerRunContext;
  counts: {
    users: number;
    creditAccounts: number;
    creditLedger: number;
    creditGrants: number;
    usageRecords: number;
    openReconciliations: number;
    pricePlans: number;
    rechargeOrdersByStatus: Record<string, number>;
  };
  sums: {
    accountBalance: number; // SUM(CreditAccount.balance)
    accountReserved: number; // SUM(CreditAccount.reservedBalance)
    accountTotal: number; // balance + reservedBalance，应与 ledgerAmount 相等
    ledgerAmount: number; // SUM(CreditLedger.amount)
    grantsTotal: number; // SUM(CreditGrant.totalAmount)
    grantsRemaining: number; // SUM(CreditGrant.remainingAmount)
    grantsReserved: number; // SUM(CreditGrant.reservedAmount)
  };
  daily: {
    date: string;
    ledgerByType: Record<string, { count: number; amount: number }>;
    consumedUsages: number; // 当日 status=consumed 的 UsageRecord
    ordersCreated: number;
    ordersPaid: number;
    ordersGranted: number;
  };
  mismatch: {
    count: number;
    top: { userId: string; total: number; ledger: number; diff: number }[];
  };
}

export function snapshotDir(): string {
  return process.env.RECONCILE_SNAPSHOT_DIR || path.join(process.cwd(), 'data', 'reconcile');
}

function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 全量 mismatch（与 reconciler 同一 SQL；行数一般很少，直接取全量后截断 top） */
async function collectMismatch(): Promise<{ count: number; top: DailySnapshot['mismatch']['top'] }> {
  const rows: any[] = await prisma.$queryRaw`
    SELECT a."userId", (a.balance + a."reservedBalance") AS total, COALESCE(SUM(l.amount), 0) AS ledger
    FROM "CreditAccount" a
    LEFT JOIN "CreditLedger" l ON l."userId" = a."userId"
    GROUP BY a."userId", a.balance, a."reservedBalance"
    HAVING (a.balance + a."reservedBalance") != COALESCE(SUM(l.amount), 0)
    ORDER BY ABS((a.balance + a."reservedBalance") - COALESCE(SUM(l.amount), 0)) DESC
  `;
  return {
    count: rows.length,
    top: rows.slice(0, 20).map((r) => ({ userId: r.userId, total: r.total, ledger: r.ledger, diff: r.total - r.ledger })),
  };
}

export async function computeSnapshot(run: ReconcilerRunContext): Promise<DailySnapshot> {
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // 本地 0 点
  const day = dayKey(now);

  const [
    users, accounts, ledgers, grants, usages, openReconciliations, plans, ordersByStatus,
    accountAgg, ledgerAgg, grantAgg, dailyLedgerRows, consumedUsages, ordersCreated, ordersPaid, ordersGranted,
    mismatch,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.creditAccount.count(),
    prisma.creditLedger.count(),
    prisma.creditGrant.count(),
    prisma.usageRecord.count(),
    prisma.reconciliationRecord.count({ where: { status: 'open' } }),
    prisma.pricePlan.count(),
    prisma.rechargeOrder.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.$queryRaw`SELECT COALESCE(SUM(balance),0)::int AS b, COALESCE(SUM("reservedBalance"),0)::int AS r FROM "CreditAccount"`,
    prisma.$queryRaw`SELECT COALESCE(SUM(amount),0)::int AS s FROM "CreditLedger"`,
    prisma.$queryRaw`SELECT COALESCE(SUM("totalAmount"),0)::int AS t, COALESCE(SUM("remainingAmount"),0)::int AS rem, COALESCE(SUM("reservedAmount"),0)::int AS res FROM "CreditGrant"`,
    prisma.$queryRaw`SELECT type, COUNT(*)::int AS cnt, COALESCE(SUM(amount),0)::int AS amt FROM "CreditLedger" WHERE "createdAt" >= ${dayStart} GROUP BY type`,
    prisma.usageRecord.count({ where: { status: 'consumed', createdAt: { gte: dayStart } } }),
    prisma.rechargeOrder.count({ where: { createdAt: { gte: dayStart } } }),
    prisma.rechargeOrder.count({ where: { paidAt: { gte: dayStart } } }),
    prisma.rechargeOrder.count({ where: { grantedAt: { gte: dayStart } } }),
    collectMismatch(),
  ]);

  const acc: any = (accountAgg as any)[0] || { b: 0, r: 0 };
  const led: any = (ledgerAgg as any)[0] || { s: 0 };
  const gr: any = (grantAgg as any)[0] || { t: 0, rem: 0, res: 0 };

  const ledgerByType: Record<string, { count: number; amount: number }> = {};
  for (const row of dailyLedgerRows as any[]) {
    ledgerByType[row.type] = { count: row.cnt, amount: row.amt };
  }

  return {
    ts: run.ts,
    day,
    source: 'credit-reconciler',
    run,
    counts: {
      users,
      creditAccounts: accounts,
      creditLedger: ledgers,
      creditGrants: grants,
      usageRecords: usages,
      openReconciliations,
      pricePlans: plans,
      rechargeOrdersByStatus: Object.fromEntries(ordersByStatus.map((o) => [o.status, o._count._all])),
    },
    sums: {
      accountBalance: acc.b,
      accountReserved: acc.r,
      accountTotal: acc.b + acc.r,
      ledgerAmount: led.s,
      grantsTotal: gr.t,
      grantsRemaining: gr.rem,
      grantsReserved: gr.res,
    },
    daily: {
      date: day,
      ledgerByType,
      consumedUsages,
      ordersCreated,
      ordersPaid,
      ordersGranted,
    },
    mismatch: { count: mismatch.count, top: mismatch.top },
  };
}

/** 主入口：计算 + 落盘（当日文件覆盖 + latest.json + 30 天清理），失败返回错误不抛 */
export async function writeDailySnapshot(run: ReconcilerRunContext): Promise<{
  ok: boolean;
  path: string;
  day: string;
  freshDay: boolean;
  error?: string;
}> {
  try {
    const snap = await computeSnapshot(run);
    const dir = snapshotDir();
    fs.mkdirSync(dir, { recursive: true });
    const dayFile = path.join(dir, `reconcile-${snap.day}.json`);
    const freshDay = !fs.existsSync(dayFile);

    const tmpFile = dayFile + '.tmp';
    fs.writeFileSync(tmpFile, JSON.stringify(snap, null, 2), 'utf8');
    fs.renameSync(tmpFile, dayFile);
    fs.writeFileSync(path.join(dir, 'latest.json'), JSON.stringify(snap, null, 2), 'utf8');
    cleanupOldSnapshots(dir, snap.day);

    console.log(
      `[reconcile-snapshot] ${freshDay ? 'new' : 'refresh'} ${snap.day}: ` +
      `users=${snap.counts.users} accounts=${snap.counts.creditAccounts} ` +
      `balance=${snap.sums.accountTotal} ledger=${snap.sums.ledgerAmount} ` +
      `grantedToday=${snap.daily.ledgerByType.grant?.count ?? 0} consumedToday=${snap.daily.ledgerByType.consume?.count ?? 0} ` +
      `refundToday=${snap.daily.ledgerByType.refund?.count ?? 0} mismatch=${snap.mismatch.count} -> ${dayFile}`
    );
    return { ok: true, path: dayFile, day: snap.day, freshDay };
  } catch (e: any) {
    return { ok: false, path: '', day: '', freshDay: false, error: e?.message || String(e) };
  }
}

/** 清理 30 天前的 reconcile-*.json（latest.json 不动） */
function cleanupOldSnapshots(dir: string, currentDay: string): void {
  try {
    const cutoff = Date.now() - 30 * 86400_000;
    for (const f of fs.readdirSync(dir)) {
      const m = /^reconcile-(\d{4}-\d{2}-\d{2})\.json$/.exec(f);
      if (!m || m[1] === currentDay) continue;
      const t = new Date(`${m[1]}T00:00:00+08:00`).getTime();
      if (!Number.isNaN(t) && t < cutoff) fs.unlinkSync(path.join(dir, f));
    }
  } catch (e) {
    console.error('[reconcile-snapshot] cleanup failed:', (e as Error).message);
  }
}
