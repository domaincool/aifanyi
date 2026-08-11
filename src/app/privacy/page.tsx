import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '隐私政策 - 爱翻译 aifanyi.com',
  description: '爱翻译 aifanyi.com 的隐私政策：我们如何收集、使用和保护您的信息。',
  robots: { index: false, follow: false },
};

export default function PrivacyPage() {
  return (
    <main className="legal-page" style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px' }}>
      <h1>隐私政策</h1>
      <p className="legal-updated">更新日期：2026 年 8 月 12 日</p>

      <h2>一、我们收集的信息</h2>
      <p>
        当您使用爱翻译（aifanyi.com）时，我们可能收集以下信息：
      </p>
      <ul>
        <li><strong>账户信息：</strong>当您使用 Google 账号或邮箱验证码登录时，我们会获取您的邮箱地址、昵称和头像（用于创建和识别您的账户）。</li>
        <li><strong>翻译内容：</strong>您提交翻译的文本、PDF 文档及翻译结果，用于为您提供翻译服务。</li>
        <li><strong>使用数据：</strong>访问时间、页面操作、任务状态等，用于改进服务和统计。</li>
        <li><strong>技术信息：</strong>IP 地址、浏览器类型等，用于安全防护和额度管理。</li>
      </ul>

      <h2>二、我们如何使用信息</h2>
      <ul>
        <li>提供、维护和改进翻译服务（文本翻译、PDF 翻译等）</li>
        <li>创建和管理您的账户与会话</li>
        <li>防止滥用、欺诈和安全威胁</li>
        <li>分析服务使用情况以优化产品</li>
      </ul>

      <h2>三、信息的共享与披露</h2>
      <p>
        我们不会出售您的个人信息。仅在以下情况可能共享：经您明确同意、法律法规要求、或为保护我们的合法权益所必需。
        翻译内容可能交由第三方 AI 翻译服务提供商（如 DeepSeek、GLM）处理以完成翻译。
      </p>

      <h2>四、数据存储与安全</h2>
      <p>
        您的数据存储于安全服务器中。我们采取行业标准的加密和安全措施保护您的信息。
        上传的 PDF 文档在任务完成后会定期自动清理，具体保留期限见服务说明。
      </p>

      <h2>五、您的权利</h2>
      <ul>
        <li>访问和导出您的账户数据</li>
        <li>删除您的账户及相关数据（在账户设置中操作）</li>
        <li>退出登录、退出所有设备</li>
      </ul>

      <h2>六、Cookie 与本地存储</h2>
      <p>
        我们使用必要的 Cookie（如登录会话 Cookie，HttpOnly 安全属性）以维持登录状态。
        我们不会在浏览器中存储长期认证令牌。
      </p>

      <h2>七、未成年人保护</h2>
      <p>本服务面向一般公众，不针对 13 周岁以下儿童。如发现未成年人信息被收集，请联系我们删除。</p>

      <h2>八、政策更新</h2>
      <p>我们可能不时更新本政策，更新后会在此页面发布。重大变更会通过站内通知告知。</p>

      <h2>九、联系我们</h2>
      <p>如对本隐私政策有任何疑问，请发送邮件至：domaincool@gmail.com</p>
    </main>
  );
}
