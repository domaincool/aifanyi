import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { buildMetadata, SITE_URL } from '@/lib/seo';
import { recordLanguageIntent } from '@/lib/metrics/server';

export const dynamic = 'force-dynamic';

const PAIRS = ['zh-en', 'en-zh'] as const;
type Pair = (typeof PAIRS)[number];

const PAIR_META: Record<Pair, { title: (w: string) => string; desc: (w: string, t: string) => string; h1: (w: string) => string; label: string }> = {
  'zh-en': {
    title: (w) => `${w} 用英语怎么说？${w} 的英文 | 爱翻译`,
    desc: (w, t) => `${w} 的英文说法是「${t}」，含双语例句、使用场景与相关表达，爱翻译 · AI翻译。`,
    h1: (w) => `${w} 用英语怎么说？`,
    label: '中 → 英',
  },
  'en-zh': {
    title: (w) => `${w} 中文什么意思？${w} 翻译 | 爱翻译`,
    desc: (w, t) => `${w} 的中文意思是「${t}」，含双语例句、使用场景与相关表达，爱翻译 · AI翻译。`,
    h1: (w) => `${w} 中文什么意思？`,
    label: '英 → 中',
  },
};

const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

export async function generateMetadata({ params }: { params: Promise<{ pair: string; word: string }> }): Promise<Metadata> {
  const { pair, word } = await params;
  if (!PAIRS.includes(pair as Pair)) return {};
  const entry = await prisma.phraseEntry.findFirst({
    where: { slug: decodeURIComponent(word), status: 'published' },
  }).catch(() => null);
  if (!entry) return {};
  const meta = PAIR_META[pair as Pair];
  return buildMetadata({
    path: `/understand/say/${pair}/${entry.slug}`,
    title: meta.title(entry.term),
    description: meta.desc(entry.term, entry.translation),
    ogType: 'content',
  });
}

export default async function SayPairPage({ params }: { params: Promise<{ pair: string; word: string }> }) {
  const { pair, word } = await params;
  if (!PAIRS.includes(pair as Pair)) notFound();
  const slug = decodeURIComponent(word);

  const entry = await prisma.phraseEntry.findFirst({
    where: { slug, status: 'published' },
  }).catch(() => null);
  if (!entry || entry.pair !== pair) notFound();

  const meta = PAIR_META[pair as Pair];
  const examples = (entry.examples as { en: string; zh: string }[]) || [];
  const tags = (entry.tags as string[]) || [];
  const primaryTag = tags[0] || null;

  // __p0rel__ 相关表达升级：同标签 ×6 + 同类目（主标签）×6 + 跨库梗卡 ×4（同标签），全部按 popularity 降序
  const [sameTag, sameCategoryRaw, crossEntries] = await Promise.all([
    prisma.phraseEntry.findMany({
      where: { pair: entry.pair, status: 'published', id: { not: entry.id }, tags: { hasSome: tags } },
      orderBy: { popularity: 'desc' },
      take: 6,
      select: { slug: true, term: true, translation: true },
    }).catch(() => [] as { slug: string; term: string; translation: string }[]),
    primaryTag
      ? prisma.phraseEntry.findMany({
          where: { pair: entry.pair, status: 'published', id: { not: entry.id }, tags: { has: primaryTag } },
          orderBy: { popularity: 'desc' },
          take: 8,
          select: { slug: true, term: true, translation: true },
        }).catch(() => [] as { slug: string; term: string; translation: string }[])
      : Promise.resolve([] as { slug: string; term: string; translation: string }[]),
    prisma.memeEntry.findMany({
      where: { status: 'published', tags: { hasSome: tags } },
      orderBy: { popularity: 'desc' },
      take: 4,
      select: { slug: true, term: true, translation: true, lang: true },
    }).catch(() => [] as { slug: string; term: string; translation: string; lang: string }[]),
  ]);

  // 同标签在前，同类目补位去重，合计 12 张词条卡
  const seenSlugs = new Set(sameTag.map((s) => s.slug));
  const categoryExtra = sameCategoryRaw.filter((s) => !seenSlugs.has(s.slug)).slice(0, Math.max(0, 12 - sameTag.length));
  const relatedEntries = [...sameTag, ...categoryExtra];

  // 服务端意图埋点（speak 类：怎么说场景）
  void recordLanguageIntent({
    query: entry.term,
    intent: entry.pair === 'zh-en' ? 'speak' : 'meaning',
    confidence: 0.8,
    source: 'say_page',
    contentMatch: 'exact',
    contentId: entry.slug,
    contentType: 'phrase',
    toolUsed: 'say_page',
  }).catch(() => {});

  // __p0schema__ 三件套：QAPage + DefinedTerm + BreadcrumbList（照搬 meme 模板标准）
  const pagePath = `/understand/say/${pair}/${entry.slug}`;
  const pageUrl = SITE_URL + pagePath;
  const datePublished = entry.createdAt.toISOString();
  const dateModified = entry.updatedAt.toISOString();

  const jsonLdQa = {
    '@context': 'https://schema.org',
    '@type': 'QAPage',
    mainEntity: {
      '@type': 'Question',
      name: meta.h1(entry.term),
      text: meta.h1(entry.term),
      answerCount: 1,
      datePublished,
      acceptedAnswer: {
        '@type': 'Answer',
        text: entry.shortAnswer,
        dateCreated: datePublished,
      },
    },
  };

  const jsonLdTerm = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    name: entry.term,
    description: entry.shortAnswer,
    translation: entry.translation,
    inDefinedTermSet: `${SITE_URL}/understand/say`,
    inLanguage: pair === 'zh-en' ? 'zh-CN' : 'en',
    termCode: entry.slug,
    dateModified,
  };

  const jsonLdBreadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '看懂语言', item: `${SITE_URL}/understand` },
      { '@type': 'ListItem', position: 2, name: '怎么说 · 高频词双语词典', item: `${SITE_URL}/understand/say` },
      { '@type': 'ListItem', position: 3, name: entry.term, item: pageUrl },
    ],
  };

  const otherPair = pair === 'zh-en' ? 'en-zh' : 'zh-en';
  const otherEntry = await prisma.phraseEntry.findFirst({
    where: { term: entry.term, pair: otherPair, status: 'published' },
    select: { slug: true },
  }).catch(() => null);

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdQa) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdTerm) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />

      <section className="hero">
        <h1>{meta.h1(entry.term)}</h1>
        <p>{PAIR_META[pair as Pair].label} · {tags[0] || '高频表达'}</p>
      </section>

      <div className="result" style={{ margin: '18px auto', maxWidth: 680 }}>
        <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent2)' }}>{entry.translation}</div>
        <div style={{ color: 'var(--muted)', marginTop: 8 }}>{entry.shortAnswer}</div>
      </div>

      {entry.definition && (
        <>
          <h2 className="section-title">详解</h2>
          <p style={{ maxWidth: 680 }}>{entry.definition}</p>
        </>
      )}

      {examples.length > 0 && (
        <>
          <h2 className="section-title">例句</h2>
          {examples.map((ex, i) => (
            <div key={i} className="result" style={{ margin: '10px 0' }}>
              <div>{ex.en}</div>
              <div style={{ color: 'var(--muted)', marginTop: 4 }}>{ex.zh}</div>
            </div>
          ))}
        </>
      )}

      <p style={{ color: 'var(--muted)', fontSize: 13, maxWidth: 680, margin: '14px auto 0' }}>
        发布于 {fmtDate(entry.createdAt)} · 更新于 {fmtDate(entry.updatedAt)} · 收录于 <Link href="/understand/say">怎么说 · 高频词双语词典</Link>
      </p>

      {relatedEntries.length > 0 && (
        <>
          <h2 className="section-title">相关表达</h2>
          <div className="entry-grid">
            {relatedEntries.map((s) => (
              <Link key={'p' + s.slug} className="entry-card" href={`/understand/say/${pair}/${s.slug}`}>
                <div className="term">{s.term}</div>
                <div className="tr">{s.translation}</div>
              </Link>
            ))}
          </div>
        </>
      )}

      {crossEntries.length > 0 && (
        <>
          <h2 className="section-title">相关网络用语</h2>
          <div className="entry-grid">
            {crossEntries.map((c) => (
              <Link key={'m' + c.slug} className="entry-card" href={(c.lang === 'en' ? '/understand/meaning/' : '/meme/') + c.slug}>
                <div className="term">{c.term}</div>
                <div className="tr">{c.translation}</div>
              </Link>
            ))}
          </div>
        </>
      )}

      {tags.length > 0 && (
        <p style={{ maxWidth: 680, margin: '16px auto 0' }}>
          {tags.map((t) => (
            <span key={t} className="chip" style={{ marginRight: 8, display: 'inline-block' }}>#{t}</span>
          ))}
        </p>
      )}

      <div className="cta-box" style={{ marginTop: 24 }}>
        <p>想翻译整句话？把内容丢进翻译框，看三种模型怎么译。</p>
        <a href="/#translator" className="btn primary">去翻译 →</a>
        {otherEntry && (
          <p style={{ marginTop: 10 }}>
            <Link href={`/understand/say/${otherPair}/${otherEntry.slug}`} style={{ color: 'var(--link, var(--accent))' }}>
              反方向：{otherPair === 'zh-en' ? `${entry.term} 的英文怎么说` : `${entry.term} 中文什么意思`} →
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
