import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createHash } from 'crypto';

/**
 * POST /api/votes
 * 盲测投票：匿名（IP+UA 哈希防刷），投票即偏好数据入库。
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // 前端只传匿名 ID（A/B/C），真实模型映射由服务端解析，避免前端暴露模型名影响投票公正
    const { blindtestId, anonymousId } = body;
    if (!blindtestId || !anonymousId) {
      return NextResponse.json({ error: 'blindtestId 与 anonymousId 必填' }, { status: 400 });
    }

    const blindtest = await prisma.blindtest.findUnique({ where: { id: blindtestId } });
    if (!blindtest) {
      return NextResponse.json({ error: '盲测不存在' }, { status: 404 });
    }

    // 解析匿名 ID → 真实模型
    const translations = (blindtest.translations as any[]) || [];
    const picked = translations.find((t) => t.anonymousId === anonymousId);
    if (!picked) {
      return NextResponse.json({ error: '匿名译文不存在' }, { status: 400 });
    }
    const model = picked.model;

    // 防刷：IP + UA 哈希，同题同人 24h 内只算一票
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const ua = req.headers.get('user-agent') || '';
    const ipHash = createHash('sha256').update(`${ip}|${ua}`).digest('hex').slice(0, 32);

    const recent = await prisma.vote.findFirst({
      where: { blindtestId, ipHash, createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } },
    });
    if (recent) {
      return NextResponse.json({ error: '24 小时内已投票' }, { status: 429 });
    }

    await prisma.$transaction([
      prisma.vote.create({ data: { blindtestId, model, ipHash } }),
      prisma.blindtest.update({
        where: { id: blindtestId },
        data: { voteCount: { increment: 1 }, winnerModel: model },
      }),
    ]);

    // 偏好数据：该模型的译文被认可 → 语料库质量分提升
    if (picked && picked.text) {
      const existing = await prisma.corpusEntry.findFirst({
        where: { sourceText: blindtest.sourceText.slice(0, 2000), targetText: picked.text.slice(0, 5000), scenario: 'blindtest' },
      });
      if (existing) {
        await prisma.corpusEntry.update({
          where: { id: existing.id },
          data: { votes: { increment: 1 }, quality: Math.min(5, existing.quality + 1) },
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '服务器错误' }, { status: 500 });
  }
}
