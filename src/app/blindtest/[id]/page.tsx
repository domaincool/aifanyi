import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import VotePanel from '@/components/VotePanel';

export const dynamic = 'force-dynamic';

/** 盲测题详情：匿名译文 + 投票（交互在 Client Component） */
export default async function BlindtestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await prisma.blindtest.findUnique({ where: { id } });
  if (!b) notFound();

  const translations = (b.translations as { anonymousId: string; text: string }[]) || [];

  return (
    <>
      <a href="/blindtest" style={{ color: 'var(--muted)', fontSize: 14 }}>← 返回擂台</a>
      <h1 style={{ marginTop: 12 }}>盲测：谁译得最好？</h1>
      <div className="result" style={{ marginTop: 16 }}>{b.sourceText}</div>
      <VotePanel blindtestId={b.id} translations={translations} />
    </>
  );
}
