import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/ecommerce/compliance-rules —— 合规规则（全局配置，无需登录）
export async function GET() {
  const rules = await prisma.ecommerceContentCompliance.findMany({
    where: { active: true },
    orderBy: [{ platform: 'asc' }, { ruleType: 'asc' }],
  });
  return NextResponse.json({ ok: true, rules });
}
