/**
 * POST /api/admin/content/import — 内容批量导入（协议 v2 直录，运营 Agent 主通道）
 * body: { batchId, items: ContentImportItem[], dryRun?, updateExisting? }
 * 权限：requireOpsOrAdmin（Bearer OPS_API_TOKEN 或 admin session）
 * 限流：ops 维度 10 分钟 20 次
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireOpsOrAdmin, checkOpsRateLimit } from '@/lib/admin/ops-auth';
import { importContent, type ContentImportItem } from '@/lib/admin/content-import';

export async function POST(req: NextRequest) {
  const identity = await requireOpsOrAdmin(req);
  if (!identity) return NextResponse.json({ error: '无权限' }, { status: 401 });

  const rl = await checkOpsRateLimit(identity.operator, 'content.', 20);
  if (!rl.ok) return NextResponse.json({ error: '操作过于频繁，请 10 分钟后再试', remaining: 0 }, { status: 429 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '无效 JSON' }, { status: 400 });
  }

  const batchId = String(body?.batchId || '').trim();
  const items = Array.isArray(body?.items) ? (body.items as ContentImportItem[]) : null;
  if (!batchId) return NextResponse.json({ error: '缺少 batchId' }, { status: 400 });
  if (!items) return NextResponse.json({ error: '缺少 items 数组' }, { status: 400 });
  if (items.length === 0) return NextResponse.json({ error: 'items 为空' }, { status: 400 });
  if (items.length > 500) return NextResponse.json({ error: '单批最多 500 条' }, { status: 400 });

  const dryRun = body.dryRun === true;
  const updateExisting = body.updateExisting === true;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null;

  const result = await importContent({ batchId, items, dryRun, updateExisting, identity, ip });
  return NextResponse.json(result);
}
