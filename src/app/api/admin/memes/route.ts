/**
 * /api/admin/memes — 词条管理列表 + 单条创建（ops/admin）
 * GET  : 列表（q 搜索 / status 过滤 / 分页）
 * POST : 单条创建（复用 importMemes，batchId 自动生成）
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireOpsOrAdmin, logAdminAction, checkOpsRateLimit } from '@/lib/admin/ops-auth';
import { importMemes, type MemeImportItem } from '@/lib/admin/meme-import';

const PAGE_SIZE = 48;

export async function GET(req: NextRequest) {
  const identity = await requireOpsOrAdmin(req);
  if (!identity) return NextResponse.json({ error: '无权限' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const q = (sp.get('q') || '').trim();
  const status = sp.get('status') || '';
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1);

  const where: any = {};
  if (q) {
    where.OR = [
      { term: { contains: q } },
      { slug: { contains: q } },
      { meaning: { contains: q } },
      { translation: { contains: q } },
    ];
  }
  if (status) where.status = status;

  const [total, memes] = await Promise.all([
    prisma.memeEntry.count({ where }),
    prisma.memeEntry.findMany({
      where,
      orderBy: [{ popularity: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, term: true, slug: true, meaning: true, translation: true,
        examples: true, tags: true, popularity: true, status: true, createdAt: true, updatedAt: true,
      },
    }),
  ]);

  return NextResponse.json({ ok: true, total, page, pageSize: PAGE_SIZE, memes, operator: identity.operator });
}

export async function POST(req: NextRequest) {
  const identity = await requireOpsOrAdmin(req);
  if (!identity) return NextResponse.json({ error: '无权限' }, { status: 401 });

  const rl = await checkOpsRateLimit(identity.operator, 'memes.', 20);
  if (!rl.ok) return NextResponse.json({ error: '操作过于频繁，请 10 分钟后再试' }, { status: 429 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '无效 JSON' }, { status: 400 });
  }

  const item: MemeImportItem = {
    term: String(body?.term || '').trim(),
    slug: String(body?.slug || '').trim(),
    meaning: String(body?.meaning || '').trim(),
    translation: String(body?.translation || '').trim(),
    examples: Array.isArray(body?.examples) ? body.examples : [],
    tags: Array.isArray(body?.tags) ? body.tags : [],
    popularity: Number(body?.popularity ?? 0),
  };

  const batchId = `create-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const result = await importMemes({ batchId, items: [item], dryRun: false, updateExisting: false, identity, ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null });
  if (result.conflicts.length > 0) {
    return NextResponse.json({ ok: false, error: `无法创建：${result.conflicts[0].reason}`, conflict: result.conflicts[0] }, { status: 409 });
  }
  if (result.skipped > 0) {
    return NextResponse.json({ ok: false, error: 'term 已存在', conflict: { reason: 'term_exists' } }, { status: 409 });
  }
  return NextResponse.json({ ok: true, created: result.created[0] });
}
