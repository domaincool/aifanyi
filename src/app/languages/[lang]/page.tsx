import { prisma } from '@/lib/db';
import Link from 'next/link';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

const LANG_SLUGS: Record<
  string,
  { country: string; lang: string; name: string; native: string; intro: string; section: string }
> = {
  vietnamese: {
    country: 'vietnam',
    lang: 'vi',
    name: '越南语',
    native: 'Tiếng Việt',
    intro: '越南语（Tiếng Việt）是越南的官方语言，使用以拉丁字母为基础的国语字书写系统，声调丰富。',
    section: '越南',
  },
  turkish: {
    country: 'turkey',
    lang: 'tr',
    name: '土耳其语',
    native: 'Türkçe',
    intro: '土耳其语（Türkçe）是土耳其的官方语言，属于突厥语系，使用拉丁字母书写，语法以黏着构词著称。',
    section: '土耳其',
  },
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const cfg = LANG_SLUGS[lang];
  if (!cfg) return { title: '世界语言 | 爱翻译' };
  return {
    title: `${cfg.name}（${cfg.native}）学习与翻译入口 · ${cfg.section}旅行 | 爱翻译`,
    description: `${cfg.name}学习与翻译入口：${cfg.section}旅行常用语、菜单词汇、地道表达一页集合，支持 AI 翻译。爱翻译 · AI翻译。`,
  };
}

export default async function LanguageDetailPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const cfg = LANG_SLUGS[lang];

  if (!cfg) {
    return (
      <div>
        <section className="hero">
          <h1>世界语言</h1>
          <p>用语言探索世界——各国语言入口与语言文化</p>
        </section>
        <div className="cta-box">
          <p>该语言页面建设中，先试试 AI 翻译工具。</p>
          <a href="/" className="btn primary">去翻译</a>
        </div>
      </div>
    );
  }

  const [travel, menus, exprs] = await Promise.all([
    prisma.sceneEntry
      .findMany({
        where: { status: 'published', kind: 'travel', country: cfg.country },
        orderBy: [{ popularity: 'desc' }, { title: 'asc' }],
        take: 12,
        select: { slug: true, title: true, intro: true },
      })
      .catch(() => []),
    prisma.menuEntry
      .findMany({
        where: { status: 'published', country: cfg.country },
        orderBy: { popularity: 'desc' },
        take: 12,
        select: { slug: true, dish: true, romanized: true, zh: true },
      })
      .catch(() => []),
    prisma.expressionEntry
      .findMany({
        where: { status: 'published', lang: cfg.lang },
        orderBy: { popularity: 'desc' },
        take: 12,
        select: { slug: true, term: true, translation: true, type: true },
      })
      .catch(() => []),
  ]);

  const empty = travel.length + menus.length + exprs.length === 0;

  return (
    <div>
      <section className="hero">
        <h1>
          {cfg.name} <span style={{ fontSize: '0.55em', fontWeight: 400, color: 'var(--muted)' }}>{cfg.native}</span>
        </h1>
        <p>{cfg.intro}</p>
      </section>

      {empty ? (
        <div className="cta-box">
          <p>{cfg.section}内容按批次建设中，先试试 AI 翻译工具。</p>
          <a href="/" className="btn primary">去翻译</a>
        </div>
      ) : (
        <>
          {travel.length > 0 && (
            <>
              <h2 className="section-title">旅行常用语（{travel.length}）</h2>
              <div className="entry-grid">
                {travel.map((s) => (
                  <Link key={s.slug} className="entry-card" href={`/travel/${cfg.country}/${s.slug}`}>
                    <div className="term">{s.title}</div>
                    <div className="mn">{s.intro}</div>
                  </Link>
                ))}
              </div>
            </>
          )}

          {menus.length > 0 && (
            <>
              <h2 className="section-title">菜单词汇（{menus.length}）</h2>
              <div className="entry-grid">
                {menus.map((m) => (
                  <Link key={m.slug} className="entry-card" href={`/menu/${cfg.country}/${m.slug}`}>
                    <div className="term">
                      {m.dish} {m.romanized ? <span style={{ fontWeight: 400, fontSize: '0.8em', color: 'var(--muted)' }}>{m.romanized}</span> : null}
                    </div>
                    <div className="mn">{m.zh}</div>
                  </Link>
                ))}
              </div>
            </>
          )}

          {exprs.length > 0 && (
            <>
              <h2 className="section-title">地道表达（{exprs.length}）</h2>
              <div className="entry-grid">
                {exprs.map((e) => (
                  <Link
                    key={e.slug}
                    className="entry-card"
                    href={e.type === 'untranslatable' ? `/untranslatable/${e.slug}` : `/idioms/${e.slug}`}
                  >
                    <div className="term">{e.term}</div>
                    <div className="mn">{e.translation}</div>
                  </Link>
                ))}
              </div>
            </>
          )}

          <div className="cta-box" style={{ marginTop: 28 }}>
            <p>
              {cfg.name}翻译——文本 / 语音 / 图片 / 文档都能翻。
            </p>
            <a href="/" className="btn primary">去翻译</a>
          </div>
        </>
      )}
    </div>
  );
}
