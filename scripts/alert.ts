/**
 * 异常告警检测（V1.2 P0-2）
 * 复用 credit-reconciler 的 30 分钟定时器，无新增 crontab。
 *
 * 检测项：
 *  1. 对账 mismatch（余额 vs Ledger 不一致）
 *  2. 单用户短时间异常大量消耗积分（30 分钟内 ≥ ALERT_CREDIT_BURST，默认 300）
 *  3. 任务失败率（近 1h PDF/字幕失败任务 ≥ ALERT_FAIL_THRESHOLD，默认 5）
 *
 * 通道：ALERT_WEBHOOK_URL（飞书机器人 webhook；通用 JSON {msg_type,content:{text}}）。
 * 未配置 webhook 时告警只落 reconciler 日志（不阻塞）。
 *
 * 环境变量（.env）：
 *  ALERT_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/xxx
 *  ALERT_CREDIT_BURST=300
 *  ALERT_FAIL_THRESHOLD=5
 */
import { prisma } from '../src/lib/db';

const WEBHOOK = process.env.ALERT_WEBHOOK_URL || '';
const BURST_THRESHOLD = Number(process.env.ALERT_CREDIT_BURST || 300);
const FAIL_THRESHOLD = Number(process.env.ALERT_FAIL_THRESHOLD || 5);
const WINDOW_MIN = 30;

export interface AlertContext {
  stuck: { settled: number; released: number; consumed: number };
  expired: { expired: number; freed: number };
  reconcile: { mismatches: number };
}

/** 主入口：检测并推送，返回告警列表（空数组 = 无异常） */
export async function checkAndAlert(ctx: AlertContext): Promise<string[]> {
  const alerts: string[] = [];

  // 1) 对账 mismatch
  if (ctx.reconcile.mismatches > 0) {
    alerts.push(`对账不一致：${ctx.reconcile.mismatches} 个账户余额与 Ledger 不符`);
  }

  // 2) 单用户 30 分钟突发消耗（排除测试账号 %@aifanyi.local）
  try {
    const burstRows: any[] = await prisma.$queryRaw`
      SELECT u."userId", SUM(u."consumedCredits")::int AS total
      FROM "UsageRecord" u
      JOIN "User" usr ON usr.id = u."userId"
      WHERE u.status = 'consumed'
        AND u."completedAt" > now() - make_interval(mins => ${WINDOW_MIN})
        AND usr.email NOT LIKE '%@aifanyi.local'
      GROUP BY u."userId"
      HAVING SUM(u."consumedCredits") >= ${BURST_THRESHOLD}
    `;
    for (const r of burstRows) {
      alerts.push(`用户 ${r.userId} ${WINDOW_MIN} 分钟内消耗 ${r.total} 积分（阈值 ${BURST_THRESHOLD}），疑似异常消耗`);
    }
  } catch (e: any) {
    console.error('[alert] burst check failed:', e?.message || e);
  }

  // 3) 任务失败率（近 1h）
  try {
    const since = new Date(Date.now() - 3600_000);
    const [pdfFail, subFail] = await Promise.all([
      prisma.pdfJob.count({ where: { status: 'failed', createdAt: { gte: since } } }),
      prisma.subtitleJob.count({ where: { status: 'failed', createdAt: { gte: since } } }),
    ]);
    if (pdfFail + subFail >= FAIL_THRESHOLD) {
      alerts.push(`近 1h 失败任务 ${pdfFail + subFail} 个（PDF ${pdfFail} / 字幕 ${subFail}），阈值 ${FAIL_THRESHOLD}`);
    }
  } catch (e: any) {
    console.error('[alert] fail-rate check failed:', e?.message || e);
  }

  if (alerts.length > 0) {
    const text = `【aifanyi 告警 ${new Date().toISOString()}】\n` + alerts.map(a => '· ' + a).join('\n');
    await sendWebhook(text);
    console.log('[alert] ' + text.replace(/\n/g, ' | '));
  }
  return alerts;
}

/** 推送 webhook（飞书机器人格式；失败不抛，只记日志） */
async function sendWebhook(text: string): Promise<void> {
  if (!WEBHOOK) return;
  try {
    const res = await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msg_type: 'text', content: { text } }),
    });
    if (!res.ok) console.error('[alert] webhook http', res.status);
  } catch (e: any) {
    console.error('[alert] webhook send failed:', e?.message || e);
  }
}
