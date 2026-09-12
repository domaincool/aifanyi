import { prisma } from '@/lib/db';
import { buildMetadata, SITE_URL } from '@/lib/seo';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

/** 盲测擂台：最近盲测题列表 */
export const metadata: Metadata = buildMetadata({
  path: '/arena',
  title: 'AI翻译盲测擂台 · 哪家AI翻译更准? | 爱翻译',
  description: '同一句话交给三个AI翻译，匿名投票选出最自然译文。真实盲测数据：150次评级总A级81.3%，DeepSeek A级98%。爱翻译盲测擂台。',
  keywords: ['AI翻译对比', '翻译盲测', '哪家AI翻译好', 'DeepSeek翻译', 'AI翻译评测'],
  ogType: 'list',
});

export default async function BlindtestListPage() {
  const list = await prisma.blindtest.findMany({
      where: { status: 'published' },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, sourceText: true, sourceLang: true, targetLang: true, voteCount: true, createdAt: true },
  });

  return (
    <>
      <h1>⚔️ AI翻译擂台</h1>
      <p style={{ color: 'var(--muted)', margin: '10px 0 24px' }}>
        同一段原文，多家 AI 匿名翻译。你觉得谁译得最好，就投谁。投票数据会用来改进翻译路由。
      </p>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            itemListElement: list.map((b, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              url: `${SITE_URL}/arena/${b.id}`,
              name: b.sourceText.slice(0, 60),
            })),
          }),
        }}
      />
      {list.length === 0 && <p style={{ color: 'var(--muted)' }}>还没有盲测题，去首页发起第一个吧（创建功能开发中）。</p>}

      <div className="entry-grid">
        {list.map((b) => (
          <a key={b.id} className="entry-card" href={`/arena/${b.id}`}>
            <div className="mn">{b.sourceLang} → {b.targetLang} · {b.voteCount} 票</div>
            <div className="tr" style={{ marginTop: 6 }}>{b.sourceText.slice(0, 80)}</div>
          </a>
        ))}
      </div>
    </>
  );
}
