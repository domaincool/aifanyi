import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireEcomUser, getOrCreateDefaultProject } from '@/lib/ecommerce/guard';

export const dynamic = 'force-dynamic';

// GET /api/ecommerce/projects —— 列出用户项目（含商品计数；Product-first 自动保证默认项目存在）
export async function GET() {
  const auth = await requireEcomUser();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  await getOrCreateDefaultProject(userId);

  const projects = await prisma.ecommerceProject.findMany({
    where: { userId, status: 'active' },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { products: true } },
    },
  });
  return NextResponse.json({ ok: true, projects });
}

// POST /api/ecommerce/projects —— 创建项目
export async function POST(req: Request) {
  const auth = await requireEcomUser();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  let body: any;
  try { body = await req.json(); } catch { body = {}; }

  const name = String(body?.name || '').trim();
  if (!name || name.length > 60) {
    return NextResponse.json({ ok: false, error: '项目名称不能为空且不超过 60 字' }, { status: 400 });
  }

  const project = await prisma.ecommerceProject.create({
    data: {
      userId,
      name,
      description: body?.description ? String(body.description).slice(0, 200) : null,
    },
  });
  return NextResponse.json({ ok: true, project }, { status: 201 });
}
