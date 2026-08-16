/**
 * P1-A-2 免费 500 消费分析（预写规则 + 首轮基线）
 * 运行：npx tsx scripts/free500-analysis.ts
 * 说明：注册赠送 500（FREE_MONTHLY，30 天到期）的用户消费画像；
 *       首轮 30 天窗口（8-15 注册）于 9-14 到期，到期后跑本脚本出完整报表；
 *       本脚本幂等，任何时候可跑（数据存在即出结果）。
 */
import { prisma } from '../src/lib/db';

async function main() {
  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

  // 1. 注册赠送总量
  const grants = await prisma.creditGrant.findMany({
    where: { type: 'FREE_GRANT', source: '注册赠送' },
    select: { userId: true, totalAmount: true, remainingAmount: true, reservedAmount: true, expiresAt: true, createdAt: true },
  });
  console.log(`== 注册赠送(FREE_MONTHLY) 总览 ==`);
  console.log(`用户数: ${new Set(grants.map(g => g.userId)).size}`);
  console.log(`赠送总量: ${grants.reduce((s, g) => s + g.totalAmount, 0)}`);
  console.log(`剩余总量: ${grants.reduce((s, g) => s + g.remainingAmount, 0)}`);
  const consumed = grants.reduce((s, g) => s + (g.totalAmount - g.remainingAmount - g.reservedAmount), 0);
  console.log(`已消耗: ${consumed}`);
  console.log(`已到期: ${grants.filter(g => g.expiresAt && g.expiresAt < now).length} 笔`);
  const windowEnd = new Date(monthAgo.getTime() + 60 * 24 * 3600 * 1000);
  console.log(`30 天内到期: ${grants.filter(g => g.expiresAt && g.expiresAt < windowEnd).length} 笔`);

  // 2. 消耗分布（按用户）
  const perUser = new Map<string, { total: number; remaining: number; consumed: number }>();
  for (const g of grants) {
    const cur = perUser.get(g.userId) || { total: 0, remaining: 0, consumed: 0 };
    cur.total += g.totalAmount;
    cur.remaining += g.remainingAmount;
    cur.consumed += g.totalAmount - g.remainingAmount - g.reservedAmount;
    perUser.set(g.userId, cur);
  }
  const users = [...perUser.values()];
  const zeroUsers = users.filter(u => u.consumed === 0).length;
  const fullUsers = users.filter(u => u.consumed >= u.total).length;
  console.log(`\n== 用户消耗分布 ==`);
  console.log(`零消耗用户: ${zeroUsers}（${users.length ? ((zeroUsers / users.length) * 100).toFixed(1) : 0}%）`);
  console.log(`耗尽用户: ${fullUsers}（${users.length ? ((fullUsers / users.length) * 100).toFixed(1) : 0}%）`);
  const sorted = users.sort((a, b) => b.consumed - a.consumed);
  console.log(`Top5 消耗: ${sorted.slice(0, 5).map(u => u.consumed).join(', ')}`);

  // 3. 触发规则（预写，供告警/报表使用）
  const rule = {
    free500_analysis: {
      window: '30d',
      trigger: '首轮 8-15 注册用户到期日 9-14 后运行',
      alert_if: [
        '零消耗率 > 80%（免费额度未拉动转化）',
        '耗尽率 > 20%（免费额度不够用，需评估加量/付费转化）',
        'Top1 消耗 > 500 的 3 倍（疑似刷额度，需查 UsageRecord 明细）',
      ],
      next_run: '2026-09-14 之后',
    },
  };
  console.log(`\n== 触发规则 ==`);
  console.log(JSON.stringify(rule, null, 2));

  // 4. 写快照（可选：append 到 stats 目录）
  const snap = {
    ts: now.toISOString(),
    users: users.length,
    total: grants.reduce((s, g) => s + g.totalAmount, 0),
    consumed,
    zeroUsers,
    fullUsers,
  };
  console.log(`\n== 快照 ==`);
  console.log(JSON.stringify(snap));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
