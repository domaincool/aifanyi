/**
 * /api/admin/blindtests — 盲测题管理（ops/admin）
 * GET  : 列表（q 搜索 / status 过滤 / 分页）
 * POST : 创建（调三模型生成匿名译文，同步写语料库）
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { translator } from '@/lib/translator/router';
import { requireOpsOrAdmin, logAdminAction, checkOpsRateLimit } from '@/lib/admin/ops-auth';

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  const identity = await requireOpsOrAdmin(req);
  if (!identity) return NextResponse.json({ error: '无权限' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const q = (sp.get('q') || '').trim();
  const status = sp.get('status') || '';
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1);

  const where: any = {};
  if (q) where.sourceText = { contains: q };
  if (status) where.status = status;

  const [total, list] = await Promise.all([
    prisma.blindtest.count({ where }),
    prisma.blindtest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, sourceText: true, sourceLang: true, targetLang: true, status: true, voteCount: true, winnerModel: true, createdAt: true, updatedAt: true },
    }),
  ]);

  return NextResponse.json({ ok: true, total, page, pageSize: PAGE_SIZE, list, operator: identity.operator });
}

export async function POST(req: NextRequest) {
  const identity = await requireOpsOrAdmin(req);
  if (!identity) return NextResponse.json({ error: '无权限' }, { status: 401 });

  const rl = await checkOpsRateLimit(identity.operator, 'blindtests.', 20);
  if (!rl.ok) return NextResponse.json({ error: '操作过于频繁，请 10 分钟后再试' }, { status: 429 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '无效 JSON' }, { status: 400 });
  }

  const sourceText = String(body?.sourceText || '').trim();
  const sourceLang = String(body?.sourceLang || 'zh').trim();
  const targetLang = String(body?.targetLang || 'en').trim();

  if (!sourceText) return NextResponse.json({ error: 'sourceText 不能为空' }, { status: 400 });
  if (sourceText.length > 2000) return NextResponse.json({ error: '盲测原文上限 2000 字符' }, { status: 400 });

  // 去重（同原文已存在）
  const dup = await prisma.blindtest.findFirst({ where: { sourceText } });
  if (dup) return NextResponse.json({ error: '该原文已存在盲测题（去重）', id: dup.id }, { status: 409 });

  // 三模型匿名译文生成
  const results = await translator.translateAll({ text: sourceText, sourceLang, targetLang, scenario: 'general' }, ['deepseek', 'glm', 'google']);
  if (results.length < 2) {
    return NextResponse.json({ error: '可用模型不足（请检查 API Key 配置）' }, { status: 502 });
  }
  const shuffled = results
    .map((r) => ({ model: r.model, text: r.text }))
    .sort(() => Math.random() - 0.5)
    .map((r, i) => ({ anonymousId: String.fromCharCode(65 + i), model: r.model, text: r.text }));

  const created = await prisma.blindtest.create({
    data: { sourceText, sourceLang, targetLang, translations: shuffled as any, status: 'published' },
  });

  // 同步语料库
  for (const s of shuffled) {
    await prisma.corpusEntry.create({
      data: {
        sourceText: sourceText.slice(0, 2000),
        targetText: s.text.slice(0, 5000),
        sourceLang,
        targetLang,
        scenario: 'blindtest',
        quality: 3,
      },
    }).catch(() => {});
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  await logAdminAction({
    identity, action: 'blindtests.create', targetId: created.id,
    params: { sourceText: sourceText.slice(0, 100), models: shuffled.map((s) => s.model) },
    ip,
  });

  return NextResponse.json({ ok: true, id: created.id, translations: shuffled.map((s) => ({ anonymousId: s.anonymousId, text: s.text })) });
}
