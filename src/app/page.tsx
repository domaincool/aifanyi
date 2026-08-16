import TranslatorBox from '@/components/TranslatorBox';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** 首页：翻译框（角1/角2 共用内核的入口）+ 双入口导流 */
export default async function HomePage() {
  let hotMemes: { term: string; slug: string; translation: string; meaning: string }[] = [];
  try {
    hotMemes = await prisma.memeEntry.findMany({ where: { status: 'published' }, orderBy: { popularity: 'desc' }, take: 6 });
  } catch {
    // 数据库未初始化时首页仍可用
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebSite",
              "@id": "https://aifanyi.com/#website",
              "url": "https://aifanyi.com/",
              "name": "爱翻译 aifanyi.com - 在线翻译,英文翻译成中文,智能翻译,实时翻译",
              "alternateName": "爱翻译",
              "description": "爱翻译提供免费在线翻译服务：英文翻译成中文、中文翻译成英文，支持实时智能翻译，翻译准确自然。跨境电商文案、外文文档、网络用语都能翻，多模型对比选更佳译文。",
              "inLanguage": "zh-CN",
              "potentialAction": {
                "@type": "SearchAction",
                "target": {
                  "@type": "EntryPoint",
                  "urlTemplate": "https://aifanyi.com/meme?q={search_term_string}"
                },
                "query-input": "required name=search_term_string"
              }
            },
            {
              "@type": "SoftwareApplication",
              "name": "爱翻译 aifanyi.com",
              "url": "https://aifanyi.com/",
              "applicationCategory": "UtilitiesApplication",
              "operatingSystem": "Web",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "CNY"
              },
              "description": "AI 在线翻译：文本、PDF、图片、字幕、Word/PPT、网页翻译，多模型对比选更佳译文。",
              "image": "https://aifanyi.com/og-image.png"
            }
          ]
        }) }}
      />
      <section className="hero">
        <h1>爱翻译 · AI翻译</h1>
        <p>让 AI 帮你把话说得像当地人。Let AI help you speak like a local.</p>
      </section>

      <TranslatorBox />

      <h2 className="section-title">🔥 网络用语翻译</h2>
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

      <h2 className="section-title">⚔️ AI翻译擂台</h2>
      <p style={{ color: 'var(--muted)' }}>
        同一句话，多家 AI 谁译得最好？<a href="/blindtest" style={{ color: 'var(--accent2)' }}>去投票 →</a>
      </p>

      <h2 className="section-title" id="workbench">💼 跨境电商工作台</h2>
      <p style={{ color: 'var(--muted)' }}>
        产品标题 / 五点描述 / 客服回复 AI 本地化，按目标市场风格档输出，多语言一键切换。
        <a href="/ecommerce" style={{ color: 'var(--accent2)' }}>去使用 →</a>
      </p>

      <section className="why-section">
        <h2 className="section-title">为什么选择爱翻译</h2>
        <p className="why-lead">✨ 翻译，不应该只是逐字替换</p>
        <div className="why-grid">
          <div className="why-card">
            <div className="why-emoji">🧠</div>
            <h3>理解上下文</h3>
            <p>AI 根据上下文、场景和语气理解真正含义。</p>
          </div>
          <div className="why-card">
            <div className="why-emoji">🎯</div>
            <h3>自动匹配语气</h3>
            <p>商务、口语、学术、电商、社交媒体，自动选择合适表达。</p>
          </div>
          <div className="why-card">
            <div className="why-emoji">🌍</div>
            <h3>真正的本地化</h3>
            <p>不只是翻译语言，更翻译文化和表达习惯。</p>
          </div>
          <div className="why-card">
            <div className="why-emoji">⚡</div>
            <h3>一个入口，处理所有内容</h3>
            <p>文本、PDF、图片、字幕、网页，一站式完成。</p>
          </div>
        </div>
      </section>

      <section className="scenes-section">
        <h2 className="section-title">为不同场景打造</h2>
        <div className="scenes-grid">
          <div className="scene-card">
            <div className="scene-emoji">🎓</div>
            <h3>学生</h3>
            <p>留学 / 论文 / 阅读</p>
          </div>
          <div className="scene-card">
            <div className="scene-emoji">💼</div>
            <h3>职场</h3>
            <p>邮件 / 文档 / 商务沟通</p>
          </div>
          <div className="scene-card">
            <div className="scene-emoji">🎬</div>
            <h3>创作者</h3>
            <p>字幕 / 视频 / 社交媒体</p>
          </div>
          <div className="scene-card">
            <div className="scene-emoji">🛒</div>
            <h3>跨境卖家</h3>
            <p>Listing / 客服 / 营销</p>
          </div>
          <div className="scene-card">
            <div className="scene-emoji">💻</div>
            <h3>开发者</h3>
            <p>API / 文档 / 本地化</p>
          </div>
        </div>
      </section>

      <section className="quick-links-section">
        <h2 className="section-title">常用 AI 翻译</h2>
        <h3 className="quick-sub">语言对</h3>
        <div className="quick-links">
          <a href="/translate/chinese-to-english">中文 → 英语</a>
          <a href="/translate/english-to-chinese">英语 → 中文</a>
          <a href="/translate/chinese-to-japanese">中文 → 日语</a>
          <a href="/translate/japanese-to-chinese">日语 → 中文</a>
          <a href="/translate/chinese-to-korean">中文 → 韩语</a>
          <a href="/translate/korean-to-chinese">韩语 → 中文</a>
        </div>
        <h3 className="quick-sub">工具</h3>
        <div className="quick-links">
          <a href="/tools/pdf-translator">PDF 翻译 · 三模型对比 · 免费积分</a>
          <a href="/tools/image-translator">图片翻译</a>
          <a href="/tools/subtitle-translator">视频字幕翻译</a>
          <a href="/tools/doc-translator">Word翻译</a>
          <a href="/tools/doc-translator">PPT翻译</a>
          <a href="/tools/web-translator">网页翻译</a>
        </div>
      </section>
    </>
  );
}
