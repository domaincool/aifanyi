import { prisma } from '@/lib/db';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 48;

// Next 15 动态路由 params 是 Promise；tag 段可能带 URL 编码，安全解码
function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ tag: string }> }): Promise<Metadata> {
  const { tag } = await params;
  const t = safeDecode(tag);
  return {
    title: t + "网络用语翻译大全 · " + t + "英文怎么说 | 爱翻译",
    description: t + "类网络热梗地道英文翻译合集：" + t + "相关网络用语，一句中文梗一句地道英文。爱翻译 · AI翻译。",
  };
}

export default async function MemeTagPage({
  params,
  searchParams,
}: {
  params: Promise<{ tag: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { tag } = await params;
  const t = safeDecode(tag);
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const where: any = { status: "published", tags: { has: t } };

  const [total, memes, tagList] = await Promise.all([
    prisma.memeEntry.count({ where }),
    prisma.memeEntry.findMany({
      where,
      orderBy: [{ popularity: "desc" }, { term: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.$queryRaw<{ tag: string; cnt: bigint }[]>`
      SELECT unnest(tags) AS tag, count(*) AS cnt FROM "MemeEntry" WHERE status = 'published' GROUP BY 1 ORDER BY 2 DESC
    `,
  ]);

  if (total === 0) notFound();

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const tagList2 = tagList.map((x) => ({ tag: x.tag, cnt: Number(x.cnt) }));
  const tagHref = (tg: string) => "/meme/tag/" + encodeURIComponent(tg);

  return (
    <div>
      <section className="hero">
        <h1>「{t}」网络用语翻译 · {t}英文怎么说</h1>
        <p>{t}类网络热梗 —— {total} 条地道英文翻译</p>
        <form className="search-box" action="/meme" method="get">
          <input type="search" name="q" placeholder="搜梗：YYDS / 破防 / 班味 / 情绪价值…" />
          <button type="submit" className="primary">搜索</button>
          <a className="clear-link" href="/meme">全部梗</a>
        </form>
      </section>

      <div className="chips">
        <Link className="chip" href="/meme">全部</Link>
        {tagList2.slice(0, 24).map((x) => (
          <Link key={x.tag} className={x.tag === t ? "chip chip-active" : "chip"} href={tagHref(x.tag)}>
            {x.tag} <span className="chip-cnt">{x.cnt}</span>
          </Link>
        ))}
      </div>

      <h2 className="section-title">「{t}」网络用语翻译（{total} 条）</h2>
      {memes.length > 0 ? (
        <div className="entry-grid">
          {memes.map((m) => (
            <Link key={m.slug} className="entry-card" href={"/meme/" + m.slug}>
              <div className="term">{m.term}</div>
              <div className="tr">{m.translation}</div>
              <div className="mn">{m.meaning}</div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <p>该分类暂无词条</p>
        </div>
      )}

      {totalPages > 1 && (
        <nav className="pagination">
          {page > 1 && (
            <Link className="page-btn" href={"/meme/tag/" + encodeURIComponent(t) + "?page=" + (page - 1)}>← 上一页</Link>
          )}
          <span className="page-info">第 {page} / {totalPages} 页</span>
          {page < totalPages && (
            <Link className="page-btn" href={"/meme/tag/" + encodeURIComponent(t) + "?page=" + (page + 1)}>下一页 →</Link>
          )}
        </nav>
      )}
    </div>
  );
}
