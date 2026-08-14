import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireEcomUser, assertProductOwned, getOrCreateDefaultProject } from '@/lib/ecommerce/guard';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/ecommerce/products/[id]/messages —— 列客户消息
export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requireEcomUser();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const { id } = await params;

  if (!(await assertProductOwned(userId, id))) {
    return NextResponse.json({ ok: false, error: '商品不存在或无权访问' }, { status: 404 });
  }

  const messages = await prisma.ecommerceCustomerMessage.findMany({
    where: { productId: id, status: 'active' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, sourceText: true, sourceLang: true, translation: true, intent: true,
      replyJson: true, tone: true, createdAt: true,
    },
  });
  return NextResponse.json({ ok: true, messages });
}

// POST /api/ecommerce/products/[id]/messages —— 录入客户消息
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireEcomUser();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;
  const { id } = await params;

  if (!(await assertProductOwned(userId, id))) {
    return NextResponse.json({ ok: false, error: '商品不存在或无权访问' }, { status: 404 });
  }

  let body: any;
  try { body = await req.json(); } catch { body = {}; }
  const sourceText = String(body?.sourceText || '').trim();
  if (!sourceText) {
    return NextResponse.json({ ok: false, error: '请输入客户消息' }, { status: 400 });
  }
  if (sourceText.length > 5000) {
    return NextResponse.json({ ok: false, error: '消息过长（限 5000 字符）' }, { status: 400 });
  }
  const sourceLang = String(body?.sourceLang || 'auto');

  const project = await getOrCreateDefaultProject(userId);
  const message = await prisma.ecommerceCustomerMessage.create({
    data: { projectId: project.id, productId: id, userId, sourceText, sourceLang },
    select: { id: true, sourceText: true, sourceLang: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, message }, { status: 201 });
}
