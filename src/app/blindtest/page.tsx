import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** 盲测擂台：最近盲测题列表 */
export default async function BlindtestListPage() {
  const list = await prisma.blindtest.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, sourceText: true, sourceLang: true, targetLang: true, voteCount: true, createdAt: true },
  });

  return (
    <>
      <h1>⚔️ 译文盲测擂台</h1>
      <p style={{ color: 'var(--muted)', margin: '10px 0 24px' }}>
        同一段原文，多家 AI 匿名翻译。你觉得谁译得最好，就投谁。投票数据会用来改进翻译路由。
      </p>

      {list.length === 0 && <p style={{ color: 'var(--muted)' }}>还没有盲测题，去首页发起第一个吧（创建功能开发中）。</p>}

      <div className="entry-grid">
        {list.map((b) => (
          <a key={b.id} className="entry-card" href={`/blindtest/${b.id}`}>
            <div className="mn">{b.sourceLang} → {b.targetLang} · {b.voteCount} 票</div>
            <div className="tr" style={{ marginTop: 6 }}>{b.sourceText.slice(0, 80)}</div>
          </a>
        ))}
      </div>
    </>
  );
}
