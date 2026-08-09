import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import TranslatorBox from '@/components/TranslatorBox';
import { TRANSLATE_PAIRS, getPairBySlug } from '@/lib/translate-pairs';

/** 语言对 SEO 页：/translate/[pair]（P0 共 7 个，静态生成） */
export const dynamicParams = false;

export function generateStaticParams() {
  return TRANSLATE_PAIRS.map((p) => ({ pair: p.slug }));
}

type Props = { params: Promise<{ pair: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pair: slug } = await params;
  const pair = getPairBySlug(slug);
  if (!pair) return {};
  return {
    title: pair.title,
    description: pair.description,
    alternates: { canonical: `/translate/${pair.slug}` },
  };
}

export default async function TranslatePairPage({ params }: Props) {
  const { pair: slug } = await params;
  const pair = getPairBySlug(slug);
  if (!pair) notFound();

  return (
    <div className="tp-page">
      <section className="tp-hero">
        <h1>{pair.h1}</h1>
        <p>{pair.intro}</p>
      </section>

      {/* 翻译框：默认语言对由 URL 决定（点 ⇄ 即可反向翻译） */}
      <TranslatorBox key={pair.slug} defaultSourceLang={pair.source} defaultTargetLang={pair.target} />

      <section className="tp-scenes">
        <h2>{pair.sourceName}→{pair.targetName} 翻译，都在这些场景</h2>
        <div className="tp-scene-grid">
          {pair.scenes.map((s) => (
            <div className="tp-scene" key={s.name}>
              <h3>{s.name}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="tp-examples">
        <h2>{pair.sourceName}翻译成{pair.targetName} · 示例</h2>
        <ul>
          {pair.examples.map((e, i) => (
            <li key={i}>
              <div className="tp-ex-src">{e.src}</div>
              <div className="tp-ex-dst">→ {e.dst}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className="tp-others">
        <h2>其他语言对</h2>
        <div className="tp-other-links">
          {TRANSLATE_PAIRS.filter((p) => p.slug !== pair.slug).map((p) => (
            <a key={p.slug} href={`/translate/${p.slug}`}>
              {p.sourceName} → {p.targetName}
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}