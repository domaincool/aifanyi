import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '解决方案 · 爱翻译 | 按角色选择 AI 翻译与本地化方案',
  description: '爱翻译解决方案：个人用户、内容创作者、跨境电商、企业、开发者的 AI 翻译与本地化方案。按你的角色找到最适合的翻译工具组合。',
};

export default function SolutionsPage() {
  return (
    <div className="solutions-page">
      <section className="hero">
        <h1>解决方案</h1>
        <p>按角色找到最适合你的 AI 翻译与本地化方式</p>
      </section>

      <div className="scenes-grid">
        <a className="scene-card" id="personal" href="/">
          <div className="scene-emoji">👤</div>
          <h3>个人用户</h3>
          <p>日常翻译 / 语言学习 / 出国旅行</p>
          <div className="sol-links">
            <a href="/">AI翻译</a> · <a href="/voice">语音翻译</a> · <a href="/travel">旅行语言</a>
          </div>
        </a>
        <a className="scene-card" id="creator" href="/tools/subtitle-translator">
          <div className="scene-emoji">🎬</div>
          <h3>内容创作者</h3>
          <p>字幕翻译 / 文案润色 / 多语言发布</p>
          <div className="sol-links">
            <a href="/tools/subtitle-translator">字幕翻译</a> · <a href="/tools/ai-polish">AI润色</a> · <a href="/tools/image-translator">图片翻译</a>
          </div>
        </a>
        <a className="scene-card" id="crossborder" href="/ecommerce">
          <div className="scene-emoji">📦</div>
          <h3>跨境电商</h3>
          <p>Listing 标题 / 五点描述 / 客服回复</p>
          <div className="sol-links">
            <a href="/ecommerce">跨境电商工作台</a> · <a href="/meme">网络用语翻译</a>
          </div>
        </a>
        <a className="scene-card" id="business" href="/tools/doc-translator">
          <div className="scene-emoji">🏢</div>
          <h3>企业</h3>
          <p>外文文档 / 官网网页 / 团队资料</p>
          <div className="sol-links">
            <a href="/tools/doc-translator">Word/PPT翻译</a> · <a href="/tools/web-translator">网页翻译</a> · <a href="/tools/pdf-translator">PDF翻译</a>
          </div>
        </a>
        <a className="scene-card" id="developer" href="/tools">
          <div className="scene-emoji">🧑‍💻</div>
          <h3>开发者</h3>
          <p>翻译 API / 集成方案（即将开放）</p>
          <div className="sol-links">
            <a href="/tools">翻译工具</a> · <a href="/blindtest">AI翻译擂台</a>
          </div>
        </a>
      </div>
    </div>
  );
}
