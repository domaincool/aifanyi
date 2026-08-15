/**
 * GET /api/admin/export — 运营看板数据导出（CSV，UTF-8 BOM，Excel 可直接打开）
 * 权限：requireOpsOrAdmin（admin session 浏览器下载 / 运营 Bearer token 脚本拉取）
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireOpsOrAdmin } from '@/lib/admin/ops-auth';
import { collectStats, type StatsData } from '@/lib/admin/stats';

function esc(v: unknown): string {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export async function GET(req: NextRequest) {
  const identity = await requireOpsOrAdmin(req);
  if (!identity) return NextResponse.json({ error: '无权限' }, { status: 401 });

  try {
    const s = await collectStats();
    const csv = buildCsv(s, identity.operator);
    const d = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
    const filename = 'attachment; filename="aifanyi-stats-' + d + '.csv"';
    return new NextResponse('\uFEFF' + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': filename,
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

function buildCsv(s: StatsData, operator: string): string {
  const L: string[] = [];
  const row = (...cells: unknown[]) => L.push(cells.map(esc).join(','));
  const blank = () => L.push('');

  const modelNames: Record<string, string> = { deepseek: 'DeepSeek', glm: 'GLM', google: 'Google', openai: 'OpenAI', claude: 'Claude' };

  // 标题
  row('爱翻译（aifanyi.com）运营统计导出');
  row('导出时间', new Date(Date.now() + 8 * 3600_000).toISOString());
  row('导出操作者', operator);
  blank();

  // 总览
  row('【总览】');
  row('指标', '数值');
  row('用户总数', s.users.total);
  row('活跃会话', s.users.activeSessions);
  row('积分账户', s.users.creditAccounts);
  row('翻译任务', s.translation.total);
  row('缓存命中率', (s.translation.cacheHitRate * 100).toFixed(1) + '%');
  row('翻译总成本USD', s.translation.costUsdTotal);
  row('梗词条', s.content.memes);
  row('盲测题', s.blindtest.total);
  row('投票数', s.blindtest.votes);
  row('PDF任务', s.pdf.jobs);
  row('PDF总成本USD', s.pdf.costUsdTotal);
  row('PDF平均耗时ms', s.pdf.avgDurationMs);
  row('PDF P50耗时ms', s.pdf.p50DurationMs);
  row('PDF P95耗时ms', s.pdf.p95DurationMs);
  blank();

  // 各模型成本
  row('【翻译·各模型成本】');
  row('模型', '模型名', '调用数', '成本USD');
  for (const [m, v] of Object.entries(s.translation.byModel)) {
    row(m, modelNames[m] || m, v.calls, v.costUsd);
  }
  blank();

  // 近 7 天（补零，与前端一致）
  row('【翻译·近7天调用】');
  row('日期', '调用数');
  for (let i = 6; i >= 0; i--) {
    const key = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const hit = s.translation.last7Days.find((x) => x.date === key);
    row(key, hit ? hit.count : 0);
  }
  blank();

  // 词条状态
  row('【内容·词条状态分布】');
  row('状态', '数量');
  for (const [k, v] of Object.entries(s.content.memesByStatus)) row(k, v);
  blank();

  // 盲测题状态
  row('【内容·盲测题状态分布】');
  row('状态', '数量');
  for (const [k, v] of Object.entries(s.content.blindtestsByStatus)) row(k, v);
  blank();

  // 盲测投票
  row('【盲测·投票分布】');
  row('模型', '票数');
  for (const [k, v] of Object.entries(s.blindtest.votesByModel)) row(k, v);
  blank();

  // PDF 事件
  row('【PDF·事件分布】');
  row('事件', '次数');
  for (const [k, v] of Object.entries(s.pdf.events)) row(k, v);

  return L.join('\n');
}
