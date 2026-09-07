import { buildMetadata } from '@/lib/seo';
import type { Metadata } from 'next';
﻿import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import VotePanel from '@/components/VotePanel';

export const dynamic = 'force-dynamic';

/** 盲测题详情：匿名译文 + 投票（交互在 Client Component） */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const b = await prisma.blindtest.findUnique({ where: { id } }).catch(() => null);
  if (!b) return buildMetadata({
    path: '/arena',
    title: 'AI翻译盲测擂台 | 爱翻译',
    description: '同一句话交给三个AI翻译，匿名投票选出最自然译文。',
    ogType: 'list',
  });
  const src = (b.sourceText || '').slice(0, 30);
  return buildMetadata({
    path: `/arena/${id}`,
    title: `${src}…三个AI怎么翻？盲测投票 | 爱翻译`,
    description: `「${(b.sourceText || '').slice(0, 60)}」的三个AI匿名译文对比，投票选最自然的一版。爱翻译盲测擂台。`,
    ogType: 'content',
    ogTitle: `${src}…三个AI怎么翻？`,
  });
}

export default async function BlindtestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await prisma.blindtest.findUnique({ where: { id } });
  if (!b || b.status !== 'published') notFound();

  const translations = (b.translations as { anonymousId: string; text: string }[]) || [];

  return (
    <>
      <a href="/arena" style={{ color: 'var(--muted)', fontSize: 14 }}>← 返回擂台</a>
      <h1 style={{ marginTop: 12 }}>盲测：谁译得最好？</h1>
      <div className="result" style={{ marginTop: 16 }}>{b.sourceText}</div>
      <VotePanel blindtestId={b.id} translations={translations} />
    </>
  );
}
