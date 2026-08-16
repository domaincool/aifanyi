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

      {/* ── 快速选择翻译工具 ── */}
      <section className="home-block" id="quick-tools">
        <h2 className="section-title">快速选择翻译工具</h2>
        <p className="block-lead">常用格式直接开翻，无需登录，新用户注册送 300 积分</p>
        <div className="tools-grid">
          <a className="tool-card" href="/tools/pdf-translator">
            <div className="tool-emoji">📄</div>
            <h2>PDF 翻译</h2>
            <p>保持排版的三模型对比翻译，失败自动退回</p>
          </a>
          <a className="tool-card" href="/tools/image-translator">
            <div className="tool-emoji">🖼️</div>
            <h2>图片翻译</h2>
            <p>截图 / 海报 / 菜单，OCR 识别后整图翻译</p>
          </a>
          <a className="tool-card" href="/tools/subtitle-translator">
            <div className="tool-emoji">🎬</div>
            <h2>字幕翻译</h2>
            <p>SRT / VTT 上传，双语对照导出</p>
          </a>
          <a className="tool-card" href="/tools/web-translator">
            <div className="tool-emoji">🌐</div>
            <h2>网页翻译</h2>
            <p>输入网址，整页正文翻译成双语对照</p>
          </a>
          <a className="tool-card" href="/tools/doc-translator">
            <div className="tool-emoji">📝</div>
            <h2>Word / PPT 翻译</h2>
            <p>docx / pptx 直接上传，保留标题与段落结构</p>
          </a>
          <a className="tool-card" href="/voice">
            <div className="tool-emoji">🎙️</div>
            <h2>语音翻译</h2>
            <p>实时对话翻译，A/B 双模型对比</p>
          </a>
        </div>
      </section>

      {/* ── 使用场景 ── */}
      <section className="scenes-section" id="scenes">
        <h2 className="section-title">为不同场景打造</h2>
        <div className="scenes-grid">
          <a className="scene-card" href="/translate/english-to-chinese">
            <div className="scene-emoji">🎓</div>
            <h3>学生</h3>
            <p>留学 / 论文 / 阅读</p>
          </a>
          <a className="scene-card" href="/tools/doc-translator">
            <div className="scene-emoji">💼</div>
            <h3>职场</h3>
            <p>邮件 / 文档 / 商务沟通</p>
          </a>
          <a className="scene-card" href="/tools/subtitle-translator">
            <div className="scene-emoji">🎬</div>
            <h3>创作者</h3>
            <p>字幕 / 视频 / 社交媒体</p>
          </a>
          <a className="scene-card" href="/travel">
            <div className="scene-emoji">✈️</div>
            <h3>旅行</h3>
            <p>出行 / 点餐 / 问路</p>
          </a>
          <a className="scene-card" href="/ecommerce">
            <div className="scene-emoji">📦</div>
            <h3>跨境电商</h3>
            <p>Listing / 客服 / 营销</p>
          </a>
          <a className="scene-card" href="/tools/web-translator">
            <div className="scene-emoji">🏢</div>
            <h3>企业</h3>
            <p>网页 / 文档 / 团队协作</p>
          </a>
        </div>
      </section>

      {/* ── 语言与世界 ── */}
      <section className="scenes-section" id="language-world">
        <h2 className="section-title">语言与世界</h2>
        <p className="block-lead">不只翻译语言，更翻译文化与表达</p>
        <div className="scenes-grid">
          <a className="scene-card" href="/travel">
            <div className="scene-emoji">✈️</div>
            <h3>旅行语言</h3>
            <p>机场 / 酒店 / 餐厅 / 购物</p>
          </a>
          <a className="scene-card" href="/recipes">
            <div className="scene-emoji">🍜</div>
            <h3>全球美食</h3>
            <p>菜谱 / 菜单 / 食材</p>
          </a>
          <a className="scene-card" href="/expressions">
            <div className="scene-emoji">💬</div>
            <h3>词汇与表达</h3>
            <p>网络用语 / 成语 / 难翻译词</p>
          </a>
          <a className="scene-card" href="/languages">
            <div className="scene-emoji">🌍</div>
            <h3>世界语言</h3>
            <p>日语 / 韩语 / 泰语 / 法语 …</p>
          </a>
          <a className="scene-card" href="/life">
            <div className="scene-emoji">🏠</div>
            <h3>海外生活</h3>
            <p>租房 / 工作 / 银行 / 快递</p>
          </a>
          <a className="scene-card" href="/culture">
            <div className="scene-emoji">🧠</div>
            <h3>语言与文化</h3>
            <p>冷知识 / 文化差异 / 词源</p>
          </a>
        </div>
      </section>

      {/* ── AI 翻译擂台 ── */}
      <section className="home-block" id="blindtest-home">
        <h2 className="section-title">⚔️ AI 翻译擂台</h2>
        <p className="block-lead">
          同一句话，多款 AI 谁译得最好？<a href="/blindtest" style={{ color: 'var(--accent2)' }}>去投票 →</a>
        </p>
        <div className="tools-grid">
          <a className="tool-card" href="/blindtest">
            <div className="tool-emoji">🆚</div>
            <h2>盲测投票</h2>
            <p>三款 AI 匿名译文，选出最地道的一句</p>
          </a>
          <a className="tool-card" href="/blindtest">
            <div className="tool-emoji">📊</div>
            <h2>擂台榜单</h2>
            <p>看 DeepSeek / GLM / Google 的实时得票</p>
          </a>
        </div>
      </section>

      {/* ── 热门内容 ── */}
      <h2 className="section-title">热门翻译 · 网络用语</h2>
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

      {/* ── 品牌优势 ── */}
      <section className="why-section">
        <h2 className="section-title">为什么选择爱翻译</h2>
        <p className="why-lead">✓ 翻译，不应该是逐字替换</p>
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
            <div className="why-emoji">🌏</div>
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


  </>
  );
}