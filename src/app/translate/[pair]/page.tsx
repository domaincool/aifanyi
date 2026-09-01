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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "HowTo",
          "name": pair.h1,
          "description": pair.intro,
          "totalTime": "PT1M",
          "step": [
            {
              "@type": "HowToStep",
              "position": 1,
              "name": "选择语言方向",
              "text": "进入爱翻译" + pair.sourceName + "翻译成" + pair.targetName + "页面，语言方向已自动设为" + pair.sourceName + "→" + pair.targetName + "。"
            },
            {
              "@type": "HowToStep",
              "position": 2,
              "name": "输入要翻译的内容",
              "text": "粘贴或输入" + pair.sourceName + "文本，支持长文、网络用语与专业术语。"
            },
            {
              "@type": "HowToStep",
              "position": 3,
              "name": "对比译文选最佳",
              "text": "DeepSeek / GLM / Google 三个 AI 的译文并排展示，选中最地道的一条，一键复制。"
            }
          ]
        }) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": [
            {
              "@type": "Question",
              "name": pair.sourceName + "翻译成" + pair.targetName + "免费吗？",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "免费使用。为保障所有用户稳定使用，每日有公平使用上限：游客 5 个文件 / 50 页，注册后升至 10 个文件 / 100 页，每日自动重置，合理用量内无需担心。"
              }
            },
            {
              "@type": "Question",
              "name": pair.sourceName + "翻译成" + pair.targetName + "质量怎么样？",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "爱翻译同时展示 DeepSeek / GLM / Google 三个 AI 的译文供对比，选最地道的一条。PDF 场景 50 段盲测中 DeepSeek A 级 98%，总 A 级 81.3%。"
              }
            },
            {
              "@type": "Question",
              "name": pair.sourceName + "翻译成" + pair.targetName + "支持哪些内容？",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "支持长文、跨境电商文案、外文文档、网络用语等。另有 PDF、图片、字幕、Word/PPT、网页翻译工具，以及 200+ 网络用语中英对照库。"
              }
            }
          ]
        }) }}
      />

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