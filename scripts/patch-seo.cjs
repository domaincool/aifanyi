const fs = require('fs');
let content = fs.readFileSync('src/app/tools/pdf-translator/page.tsx', 'utf-8');

// Fix H1
content = content.replace(
  /<section className="pdf-hero">\s+<h1>[^<]+<\/h1>\s+<p>[^<]+<\/p>\s+<\/section>/,
  `<section className="pdf-hero">
        <h1>免费 PDF 在线翻译</h1>
        <p>上传 PDF 自动翻译成中文 / 英文，DeepSeek / GLM / Google 三模型对比翻译，双语对照阅读，保留标题列表结构，支持下载 DOCX / TXT。</p>
      </section>`
);

// Add SEO sections after privacy notice (before error section)
const seoSections = `

      {/* ===== PDF SEO 内容区 ===== */}
      <section className="pdf-seo">
        <h2>怎么用</h2>
        <div className="pdf-seo-steps">
          <div className="pdf-seo-step"><span className="pdf-seo-step-num">1</span><strong>上传 PDF 文件</strong><p>支持拖拽或点击选择，≤20MB / ≤100页</p></div>
          <div className="pdf-seo-step"><span className="pdf-seo-step-num">2</span><strong>自动识别源语言并翻译</strong><p>选择目标语言后开始翻译，支持 10 种语言互译</p></div>
          <div className="pdf-seo-step"><span className="pdf-seo-step-num">3</span><strong>双语对照阅读与下载</strong><p>段落不满意可对比三个 AI 模型译文，下载 DOCX 或 TXT</p></div>
        </div>

        <h2>核心功能</h2>
        <div className="pdf-seo-features">
          <div className="pdf-seo-feature"><h3>三模型对比</h3><p>同一段落可切换查看 DeepSeek / GLM / Google 三个 AI 的译文，选中最佳直接替换——不信任任何单一 AI 的翻译结果。基于 50 段盲测：DeepSeek A 级 98%，Google A 级 84%，GLM A 级 62%。</p></div>
          <div className="pdf-seo-feature"><h3>双语对照阅读</h3><p>桌面端左原文右译文，手机端上下排列；标题对标题、列表对列表、段落对段落，不丢失文档结构。</p></div>
          <div className="pdf-seo-feature"><h3>智能结构识别</h3><p>自动识别 PDF 中的标题、正文、列表和段落，保留阅读层次；页眉页脚自动跳过。</p></div>
          <div className="pdf-seo-feature"><h3>多种下载格式</h3><p>译文 DOCX（编辑用）、双语对照 DOCX（存档审校）、纯文本 TXT。</p></div>
          <div className="pdf-seo-feature"><h3>隐私保护</h3><p>文件 24 小时后自动删除，翻译过程明示调用第三方 AI API（DeepSeek / GLM / Google）。</p></div>
        </div>

        <h2>适用场景</h2>
        <div className="pdf-seo-scenarios">
          <div className="pdf-seo-scenario"><h3>📄 英文合同 / 协议</h3><p>三模型对比避免关键条款误译，尤其术语和数字。</p></div>
          <div className="pdf-seo-scenario"><h3>📚 外文文献 / 论文</h3><p>保留标题列表结构，双语对照精读，下载 DOCX 编辑引用。</p></div>
          <div className="pdf-seo-scenario"><h3>📖 英文说明书 / 技术文档</h3><p>快速理解技术细节，段落级对比确保术语一致性。</p></div>
          <div className="pdf-seo-scenario"><h3>🛒 海外购物单据 / 账单</h3><p>翻译发票、订单确认、保修卡等轻量文档。</p></div>
          <div className="pdf-seo-scenario"><h3>💼 跨境电商 Listing / 产品资料</h3><p>竞品详情页翻译、平台政策文档理解。</p></div>
        </div>

        <h2>常见问题</h2>
        <div className="pdf-seo-faq">
          <div className="pdf-seo-faq-item"><h3>免费吗？有次数限制吗？</h3><p>完全免费使用，无需登录。每日免费额度：5 个文件 / 累计 50 页（以先达到者为准）。</p></div>
          <div className="pdf-seo-faq-item"><h3>支持多大文件？</h3><p>单个文件 ≤ 20MB，≤ 100 页，文本量 ≤ 100 万字符。超过任一限制会在上传时直接提示，不会浪费等待时间。</p></div>
          <div className="pdf-seo-faq-item"><h3>扫描版 PDF 支持吗？</h3><p>当前版本仅支持文本型 PDF（Word / Google Docs 等导出的单栏文档效果最佳）。如果上传扫描版（纯图片）PDF，页面会明确提示"暂不支持"，并引导到即将推出的 OCR 功能。</p></div>
          <div className="pdf-seo-faq-item"><h3>能保留原 PDF 的排版吗？</h3><p>当前版本为双语阅读器模式（左右对照阅读），不输出原版式 PDF。原版式 PDF 重建功能在后续版本规划中。</p></div>
          <div className="pdf-seo-faq-item"><h3>翻译质量怎么样？</h3><p>默认使用 DeepSeek 主模型翻译（50 段盲测 A 级 98%）。对任意段落不满意，可点击"查看其他模型"切换到 GLM / Google 的译文，选择你最满意的一版。</p></div>
          <div className="pdf-seo-faq-item"><h3>文件安全吗？会保存我的 PDF 吗？</h3><p>原始 PDF 翻译完成后即删除，翻译结果 24 小时后自动清理。翻译过程会调用第三方 AI 模型 API（DeepSeek / GLM / Google），上传前页面已明示。</p></div>
          <div className="pdf-seo-faq-item"><h3>支持哪些语言？</h3><p>支持 10 种语言互译：中文、英文、日文、韩文、法文、德文、俄文、西班牙文、葡萄牙文、阿拉伯文。</p></div>
        </div>

        <h2>限制说明</h2>
        <ul className="pdf-seo-limits">
          <li>扫描版 PDF（纯图片无文本层）暂不支持，OCR 功能后续推出</li>
          <li>多栏 / 报纸排版 PDF 可能出现阅读顺序错乱，页面会标注提示</li>
          <li>复杂表格可能退化为逐行文本，表格结构化功能在后续版本规划中</li>
          <li>文件大小 ≤ 20MB、页数 ≤ 100 页、文本 ≤ 100 万字符，超限直接拒绝</li>
        </ul>
      </section>`;

// Insert after the privacy notice div close, before error section comment
content = content.replace(
  /(\s*)(\{\/\* 锟斤拷锟斤拷锟斤拷锟斤拷)/,
  seoSections + '\n\n      $1$2'
);

fs.writeFileSync('src/app/tools/pdf-translator/page.tsx', content, 'utf-8');
console.log('Done, length:', content.length);