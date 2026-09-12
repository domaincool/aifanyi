import { prisma } from '@/lib/db';
import { buildMetadata, SITE_URL } from '@/lib/seo';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

/** AI 翻译擂台：今日擂台（日期种子轮换精选）+ 全部题目（有票在前，0 票不直出）__p1arena__ */
export const metadata: Metadata = buildMetadata({
  path: '/arena',
  title: 'AI翻译盲测擂台 · 哪家AI翻译更准? | 爱翻译',
  description: '同一句话交给三个AI翻译，匿名投票选出最自然译文。真实盲测数据：150次评级总A级81.3%，DeepSeek A级98%。爱翻译盲测擂台。',
  keywords: ['AI翻译对比', '翻译盲测', '哪家AI翻译好', 'DeepSeek翻译', 'AI翻译评测'],
  ogType: 'list',
});

/** 日期种子：YYYY-MM-DD 字符串 hash → 稳定伪随机偏移 */
function daySeed(dateKey: string): number {
  let h = 0;
  for (let i = 0; i < dateKey.length; i++) h = (h * 31 + dateKey.charCodeAt(i)) >>> 0;
  return h;
}

export default async function BlindtestListPage() {
  const all = await prisma.blindtest.findMany({
    where: { status: 'published' },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, sourceText: true, sourceLang: true, targetLang: true, voteCount: true, createdAt: true },
  });

  // ── 今日擂台：日期种子从题库稳定轮换 5 题（冷启动期不按票数排名，避免 0 票死区）──
  const dateKey = new Date().toISOString().slice(0, 10);
  const seed = daySeed(dateKey);
  const pool = [...all];
  const todays: typeof all = [];
  while (pool.length > 0 && todays.length < 5) {
    todays.push(pool.splice(seed % pool.length, 1)[0]);
  }

  // ── 全部题目：有票在前（票数降序），0 票排后但不再显示「0 票」──
  const rest = [...all].sort((a, b) => b.voteCount - a.voteCount);

  return (
    <>
      <h1>⚔️ AI翻译擂台</h1>
      <p style={{ color: 'var(--muted)', margin: '10px 0 24px' }}>
        同一段原文，多家 AI 匿名翻译。你觉得谁译得最好，就投谁。投票数据会用来改进翻译路由。
      </p>

      {todays.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 18, margin: '0 0 4px' }}>🔥 今日擂台</h2>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 12px' }}>
            {dateKey} 精选 {todays.length} 道——每天换一批，投出你的判断。
          </p>
          <div className="entry-grid">
            {todays.map((b) => (
              <a key={b.id} className="entry-card" href={`/arena/${b.id}`}>
                <div className="mn">{b.sourceLang} → {b.targetLang}{b.voteCount > 0 ? ` · ${b.voteCount} 票` : ' · 等你投第一票'}</div>
                <div className="tr" style={{ marginTop: 6 }}>{b.sourceText.slice(0, 80)}</div>
              </a>
            ))}
          </div>
        </section>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            itemListElement: rest.map((b, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              url: `${SITE_URL}/arena/${b.id}`,
              name: b.sourceText.slice(0, 60),
            })),
          }),
        }}
      />
      <h2 style={{ fontSize: 18, margin: '0 0 12px' }}>全部题目</h2>
      {rest.length === 0 && <p style={{ color: 'var(--muted)' }}>还没有盲测题，去首页发起第一个吧。</p>}
      <div className="entry-grid">
        {rest.map((b) => (
          <a key={b.id} className="entry-card" href={`/arena/${b.id}`}>
            <div className="mn">{b.sourceLang} → {b.targetLang}{b.voteCount > 0 ? ` · ${b.voteCount} 票` : ' · 等你投第一票'}</div>
            <div className="tr" style={{ marginTop: 6 }}>{b.sourceText.slice(0, 80)}</div>
          </a>
        ))}
      </div>
    </>
  );
}
