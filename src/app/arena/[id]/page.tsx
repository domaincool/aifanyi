import { buildMetadata } from '@/lib/seo';
import type { Metadata } from 'next';
﻿import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import VotePanel from '@/components/VotePanel';
import { recordContentView } from '@/lib/metrics/server';
import { cookies } from 'next/headers';

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

  const translations = (b.translations as { anonymousId: string; text: string; model?: string }[]) || [];

  // F10 V1：按真实模型聚合票数 → 映射回匿名 ID 传给前端（分布投票后揭示，防从众引导）
  const voteGroups = await prisma.vote.groupBy({ by: ['model'], _count: { _all: true }, where: { blindtestId: b.id } });
  const totalVotes = voteGroups.reduce((acc, g) => acc + g._count._all, 0);
  const votesByAnon: Record<string, number> = {};
  for (const t of translations) {
    const g = voteGroups.find((v) => v.model === t.model);
    if (g) votesByAnon[t.anonymousId] = g._count._all;
  }

  // 内容埋点（V1.0 Week4：arena 详情页 pageview）
  recordContentView('arena', b.id, (await cookies()).get('aifanyi_cs')?.value ?? null).catch(() => {});

  return (
    <>
      <a href="/arena" style={{ color: 'var(--muted)', fontSize: 14 }}>← 返回擂台</a>
      <h1 style={{ marginTop: 12 }}>盲测：谁译得最好？</h1>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "QAPage",
          "mainEntity": {
            "@type": "Question",
            "name": "「" + (b.sourceText || "").slice(0, 40) + "」哪个 AI 译文最自然？",
            "text": b.sourceText,
            "answerCount": Math.max(translations.length, 1),
            "acceptedAnswer": translations.length > 0 ? {
              "@type": "Answer",
              "text": "匿名译文 " + translations[0].anonymousId + "：" + (translations[0].text || "").slice(0, 80) + "…（投票选出最自然的一版）",
              "url": "https://aifanyi.com/arena/" + b.id
            } : undefined
          }
        }) }}
      />
      <div className="result" style={{ marginTop: 16 }}>{b.sourceText}</div>
      <VotePanel blindtestId={b.id} translations={translations} votesByAnon={votesByAnon} totalVotes={totalVotes} />
    </>
  );
}
