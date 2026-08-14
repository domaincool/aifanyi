import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/ecommerce/platform-rules —— 平台规则（全局配置，无需登录）
export async function GET() {
  const rules = await prisma.ecommercePlatformRule.findMany({
    where: { active: true },
    orderBy: [{ platform: 'asc' }, { field: 'asc' }, { version: 'desc' }],
  });
  return NextResponse.json({ ok: true, rules });
}
