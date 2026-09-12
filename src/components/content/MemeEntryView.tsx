import { prisma } from '@/lib/db';
import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import { recordContentView } from '@/lib/metrics/server';
import { cookies } from 'next/headers';
import ToolCtaButton from '@/components/ToolCtaButton';
import ContentScrollTracker from '@/components/ContentScrollTracker';

export async function buildMemeMetadata(slug: string): Promise<Metadata> {
  const m = await prisma.memeEntry.findUnique({ where: { slug } }).catch(() => null);
  if (!m || m.status !== 'published') return { title: '网络用语翻译 | 爱翻译 aifanyi.com' };
  const isEn = m.lang === 'en';
  return buildMetadata({
    // __p0mb__ en 词条 canonical 指稳定 Meaning URL
    path: isEn ? `/understand/meaning/${m.slug}` : `/meme/${m.slug}`,
    title: isEn
      ? `${m.term} 中文什么意思？${m.term} → ${m.translation} | 爱翻译`
      : `${m.term} 英文怎么说？${m.term} → ${m.translation} | 爱翻译`,
    description: isEn
      ? `${m.term}（${m.meaning}）的中文意思是「${m.translation}」。含例句与使用场景，爱翻译 · AI翻译。`
      : `${m.term}（${m.meaning}）的地道英文表达是「${m.translation}」。含例句与使用场景，爱翻译 · AI翻译。`,
    ogType: 'content',
    ogTitle: isEn ? `${m.term} 是什么意思？→ ${m.translation}` : `${m.term} 用英语怎么说？→ ${m.translation}`,
  });
}

export default async function MemeEntryView({ slug, isMeaningRoute = false }: { slug: string; isMeaningRoute?: boolean }) {
  const m = await prisma.memeEntry.findUnique({ where: { slug } });
  if (!m || m.status !== 'published') notFound();
  // __p0meaning__ en 词条的稳定 URL 是 /understand/meaning/[slug]（Meaning SEO 层），meme URL 301 过去
  // __p0fix-loop__ 分流：meme URL 对 en 词条 301 到 Meaning URL；Meaning URL 只服务 en 词条（避免自指死循环）
  if (isMeaningRoute) {
    if (m.lang !== 'en') notFound();
  } else if (m.lang === 'en') {
    permanentRedirect('/understand/meaning/' + m.slug);
  }
  // 埋点（V1.0 D5）：词条页浏览计数 + 触点日志（P5 归因）
  recordContentView('meme', m.slug, (await cookies()).get('aifanyi_cs')?.value ?? null).catch(() => {});

  const examples = (m.examples as { zh: string; en: string }[]) || [];
  const isEn = m.lang === 'en';
  const tags = (m.tags as string[]) || [];
  // V1.1 P0-2 产品化：以下字段全部条件渲染，无数据不出现空壳区块
  const usage = m.usage || '';
  const TONE_CN: Record<string, string> = { formal: '正式', casual: '口语', playful: '调侃', sarcastic: '讽刺', positive: '褒义', negative: '贬义', neutral: '中性' };
  const TONE_HINT: Record<string, string> = { formal: '适合正式场合', casual: '适合日常口语', playful: '适合玩梗调侃', sarcastic: '带讽刺意味，慎用', positive: '偏褒义', negative: '偏贬义', neutral: '语气中性' };
  const tones = (m.tone || '').split(',').map((t) => t.trim()).filter((t) => !!TONE_CN[t]);
  const collocations = ((m.collocations as { phrase: string; zh?: string; note?: string }[] | null) || []).filter((c) => !!(c && c.phrase));
  const misTranslated = ((m.misTranslated as { wrong: string; right: string; why?: string }[] | null) || []).filter((x) => !!(x && x.wrong && x.right));
  let sources: { sourceName: string | null; sourceUrl: string | null; sourceDate: string | null; sourceType: string; note: string | null }[] = [];
  try {
    sources = await prisma.contentSource.findMany({
      where: { refType: 'meme', refId: m.id },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { sourceName: true, sourceUrl: true, sourceDate: true, sourceType: true, note: true },
    });
  } catch {
    // 来源表可空：读不到则整块不渲染
  }
  // V1.1 P1-2 任务型 CTA
  const ctaHref = isMeaningRoute
    ? '/?q=' + encodeURIComponent(m.term) + '#translator'
    : '/?q=' + encodeURIComponent((examples[0] && examples[0].zh) || m.term) + '#translator';
  const ctaLabel = isMeaningRoute ? '把含有 ' + m.term + ' 的句子翻成中文 →' : '把这句话翻成地道英文 →';

  // 相关梗：同 tag 的其他词条，站内互链吃长尾流量
  let related: { slug: string; term: string; translation: string; lang?: string }[] = [];
  try {
    // 内链引擎（V1.0 D15）：content_relation 语义关系优先，tags 共现兜底
    const rels = await prisma.contentRelation.findMany({
      where: { fromType: 'meme', fromId: m.id, relation: { in: ['similar', 'synonym', 'used_with', 'related_meme', 'derived_from'] } },
      orderBy: { weight: 'desc' },
      take: 8,
    });
    if (rels.length > 0) {
      const toIds = rels.map((r) => r.toId);
      const raw = await prisma.memeEntry.findMany({
        where: { id: { in: toIds }, status: 'published' },
        select: { id: true, slug: true, term: true, translation: true, lang: true }, // __p0fix-link__
      });
      // 按 relation weight 排序（rels 顺序）
      const byId = new Map(raw.map((r: any) => [r.id ?? r.slug, r]));
      related = rels.map((r) => byId.get(r.toId)).filter(Boolean).slice(0, 6);
    }
    if (related.length === 0 && tags.length > 0) {
      const raw = await prisma.memeEntry.findMany({
        where: { status: "published", tags: { hasSome: tags } },
        orderBy: { popularity: "desc" },
        take: 8,
        select: { slug: true, term: true, translation: true, lang: true }, // __p0fix-link__
      });
      related = raw.filter((r) => r.slug !== m.slug).slice(0, 6);
    }
  } catch {
    // 相关梗查询失败不影响主内容
  }

  return (
    <>
      <h1>{m.term}{isEn ? ' 中文什么意思？' : ' 用英语怎么说？'}</h1>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          "headline": m.term + (isEn ? " 中文什么意思？" : " 用英语怎么说？") + m.term + " → " + m.translation,
          "description": m.term + "（" + m.meaning + "）" + (isEn ? "的中文意思是「" + m.translation + "」" : "的地道英文表达是「" + m.translation + "」") + "。含例句与使用场景，爱翻译 · AI翻译。",
          "datePublished": m.createdAt,
          "dateModified": m.updatedAt,
          "inLanguage": "zh-CN",
          "mainEntityOfPage": "https://aifanyi.com" + (isEn ? "/understand/meaning/" : "/meme/") + m.slug, // __p0mb__
          "author": {
            "@type": "Organization",
            "name": "爱翻译 aifanyi.com",
            "url": "https://aifanyi.com/"
          },
          "publisher": {
            "@type": "Organization",
            "name": "爱翻译",
            "url": "https://aifanyi.com/",
            "logo": {
              "@type": "ImageObject",
              "url": "https://aifanyi.com/og-image.png",
              "width": 1200,
              "height": 630
            }
          }
        }) }}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "DefinedTerm",
          "name": m.term,
          "description": (m.shortAnswer as string) || m.meaning,
          "inDefinedTermSet": "https://aifanyi.com" + (isEn ? "/understand/meaning" : "/meme"),
          "inLanguage": isEn ? "en" : "zh-CN"
        }) }}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "看懂语言", "item": "https://aifanyi.com/understand" },
            isEn
              ? { "@type": "ListItem", "position": 2, "name": "词义快答", "item": "https://aifanyi.com/understand/meaning" }
              : { "@type": "ListItem", "position": 2, "name": "网络用语与俚语", "item": "https://aifanyi.com/meme" },
            { "@type": "ListItem", "position": 3, "name": m.term, "item": "https://aifanyi.com" + (isEn ? "/understand/meaning/" : "/meme/") + m.slug }
          ]
        }) }}
      />

      {(m.shortAnswer as string) && (
        <div className="short-answer">
          <div className="sa-label">一句话答案</div>
          <div className="sa-text">{m.shortAnswer as string}</div>
        </div>
      )}

      <p style={{ color: 'var(--muted)' }}>{m.meaning}</p>

      <div className="translator-box" style={{ maxWidth: 'none' }}>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>地道表达</div>
        <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent2)', margin: '6px 0' }}>{m.translation}</div>
      </div>

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

      {usage && (
        <>
          <h2 className="section-title">怎么使用</h2>
          <p>{usage}</p>
        </>
      )}

      {tones.length > 0 && (
        <>
          <h2 className="section-title">语气 · 情绪</h2>
          <p>
            {tones.map((t) => (
              <span key={t} className="chip" style={{ marginRight: 8 }}>{TONE_CN[t]}</span>
            ))}
          </p>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            {tones.map((t) => TONE_HINT[t]).join(' · ')}
          </p>
        </>
      )}

      {collocations.length > 0 && (
        <>
          <h2 className="section-title">常见搭配</h2>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {collocations.map((c, i) => (
              <li key={i} style={{ marginBottom: 6 }}>
                <b>{c.phrase}</b>
                {c.zh && <span style={{ color: 'var(--muted)' }}> —— {c.zh}</span>}
                {c.note && <div style={{ color: 'var(--muted)', fontSize: 13 }}>{c.note}</div>}
              </li>
            ))}
          </ul>
        </>
      )}

      {misTranslated.length > 0 && (
        <>
          <h2 className="section-title">容易误解的地方</h2>
          <div style={{ margin: '8px 0 0' }}>
            {misTranslated.map((x, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div><span style={{ color: 'var(--muted)' }}>❌ {x.wrong}</span> → <b style={{ color: 'var(--accent2)' }}>✅ {x.right}</b></div>
                {x.why && <div style={{ color: 'var(--muted)', fontSize: 13 }}>{x.why}</div>}
              </div>
            ))}
          </div>
        </>
      )}

      {sources.length > 0 && (
        <>
          <h2 className="section-title">来源 · 文化背景</h2>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {sources.map((s, i) => (
              <li key={i} style={{ marginBottom: 6 }}>
                {s.sourceUrl ? (
                  <a href={s.sourceUrl} rel="nofollow noopener" target="_blank" style={{ color: 'var(--accent2)' }}>{s.sourceName || s.sourceUrl}</a>
                ) : (
                  <span>{s.sourceName || '来源'}</span>
                )}
                {s.sourceDate && <span style={{ color: 'var(--muted)' }}> · {s.sourceDate}</span>}
                {s.note && <div style={{ color: 'var(--muted)', fontSize: 13 }}>{s.note}</div>}
              </li>
            ))}
          </ul>
        </>
      )}

      {related.length > 0 && (
        <>
          <h2 className="section-title">相关梗 · 同类网络用语</h2>
          <div className="entry-grid">
            {related.map((r) => (
              // __p0fix-link__ 相关梗卡片：按语言分流到对应 URL
              <a key={r.slug} className="entry-card" href={(r.lang === 'en' ? "/understand/meaning/" : "/meme/") + r.slug}>
                <div className="term">{r.term}</div>
                <div className="tr">{r.translation}</div>
              </a>
            ))}
          </div>
        </>
      )}

      {tags.length > 0 && (
        <p style={{ marginTop: 16 }}>
          {tags.map((t) => (
            <a key={t} className="chip" href={"/meme/tag/" + encodeURIComponent(t)} style={{ marginRight: 8 }}>
              {"#" + t}
            </a>
          ))}
        </p>
      )}
      <h2 className="section-title">还有疑问？问 Ask AIFANYI</h2>
      <p style={{ color: 'var(--muted)', fontSize: 14 }}>
        不确定「{m.term}」能不能用在正式场合、有没有别的说法？直接问 AI。
      </p>
      <p style={{ marginTop: 8 }}>
        <a className="btn" href={'/understand/meaning?q=' + encodeURIComponent(m.term)}>问 AIFANYI：{m.term} 怎么用？ →</a>
      </p>

      <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <ToolCtaButton contentType="meme" contentId={m.slug} href={ctaHref} label={ctaLabel} />
        <ContentScrollTracker contentType="meme" contentId={m.slug} />
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>还想翻别的梗？去<a href="/arena" style={{ color: 'var(--accent2)' }}>擂台</a>看哪家 AI 最强。</span>
      </div>
    </>
  );
}
