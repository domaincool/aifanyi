import TranslatorBox from '@/components/TranslatorBox';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** 首页：翻译框（角1/角2 共用内核的入口）+ 双入口导流 */
export default async function HomePage() {
  let hotMemes: { term: string; slug: string; translation: string; meaning: string }[] = [];
  try {
    hotMemes = await prisma.memeEntry.findMany({ orderBy: { popularity: 'desc' }, take: 6 });
  } catch {
    // 数据库未初始化时首页仍可用
  }

  return (
    <>
      <section className="hero">
        <h1>爱翻译，认真翻译</h1>
        <p>跨境电商 Listing 本地化 · 译文盲测擂台 · 网络用语翻译 —— 让翻译被爱。</p>
      </section>

      <TranslatorBox />

      <h2 className="section-title">🔥 热梗翻译</h2>
      <div className="entry-grid">
        {hotMemes.length > 0 ? (
          hotMemes.map((m) => (
            <a key={m.slug} className="entry-card" href={`/meme/${m.slug}`}>
              <div className="term">{m.term}</div>
              <div className="tr">{m.translation}</div>
              <div className="mn">{m.meaning}</div>
            </a>
          ))
        ) : (
          <p style={{ color: 'var(--muted)' }}>梗词条库准备中，先试试上面的翻译框 →</p>
        )}
      </div>

      <h2 className="section-title">⚔️ 译文盲测擂台</h2>
      <p style={{ color: 'var(--muted)' }}>
        同一句话，多家 AI 谁译得最好？<a href="/blindtest" style={{ color: 'var(--accent2)' }}>去投票 →</a>
      </p>

      <h2 className="section-title" id="workbench">💼 跨境电商工作台</h2>
      <p style={{ color: 'var(--muted)' }}>
        标题 / 五点描述 / 客服邮件本地化，按目标市场风格档输出。MVP 开发中，敬请期待。
      </p>
    </>
  );
}
