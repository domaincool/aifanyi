/**
 * 健康检查端点（审计 P2「无监控」修复，运维探活用，无鉴权）
 * GET /api/health
 * 返回：进程存活、DB 连通、内存、uptime、node 版本、最近错误数
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// 进程启动时间（模块加载即记录）
const startedAt = Date.now();

export const dynamic = 'force-dynamic';

export async function GET() {
  const mem = process.memoryUsage();
  const uptimeMs = Date.now() - startedAt;

  // DB 探活
  let dbOk = false;
  let dbError: string | null = null;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  // 最近 1 小时错误数（若 ErrorLog 表存在）
  let recentErrors = 0;
  try {
    recentErrors = await prisma.errorLog.count({
      where: { createdAt: { gte: new Date(Date.now() - 3600_000) } },
    });
  } catch {
    recentErrors = 0;
  }

  const status = dbOk ? 'ok' : 'degraded';

  return NextResponse.json(
    {
      status,
      db: dbOk ? 'ok' : 'error',
      dbError,
      uptimeMs,
      uptimeHuman: humanize(uptimeMs),
      memory: {
        rss: mem.rss,
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
      },
      node: process.version,
      pid: process.pid,
      recentErrors1h: recentErrors,
      timestamp: new Date().toISOString(),
    },
    { status: dbOk ? 200 : 503 }
  );
}

function humanize(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}
