import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '服务条款 - 爱翻译 aifanyi.com',
  description: '爱翻译 aifanyi.com 的服务条款：使用本服务前请阅读。',
  robots: { index: false, follow: false },
};

export default function TermsPage() {
  return (
    <main className="legal-page" style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px' }}>
      <h1>服务条款</h1>
      <p className="legal-updated">更新日期：2026 年 8 月 12 日</p>

      <h2>一、服务说明</h2>
      <p>
        爱翻译（aifanyi.com）提供 AI 翻译服务，包括文本翻译、PDF 文档翻译、网络用语翻译等功能。
        使用本服务即表示您同意本条款。
      </p>

      <h2>二、账户</h2>
      <ul>
        <li>您可以使用 Google 账号或邮箱验证码注册/登录。</li>
        <li>您有责任保护您的账户安全，不得将账户转让给他人。</li>
        <li>您可随时在账户设置中注销账户。</li>
      </ul>

      <h2>三、可接受使用</h2>
      <p>您承诺不利用本服务从事以下行为：</p>
      <ul>
        <li>上传或翻译违反法律法规、侵犯他人权益的内容</li>
        <li>滥用免费积分、恶意刷量、干扰服务正常运行</li>
        <li>试图未经授权访问其他用户的数据或系统</li>
      </ul>

      <h2>四、积分与付费</h2>
      <p>
        本服务提供每日免费积分（游客与登录用户积分不同）。未来可能推出付费订阅（Credits/Pro），
        具体规则以届时公布为准。
      </p>

      <h2>五、知识产权</h2>
      <p>
        本网站的商标、界面设计、代码等知识产权归爱翻译所有。
        您提交的翻译内容的知识产权归您所有，您授权我们仅为提供翻译服务而处理这些内容。
      </p>

      <h2>六、免责声明</h2>
      <p>
        AI 翻译结果可能存在错误或不准确之处，仅供参考。对于因使用翻译结果造成的任何损失，
        我们不承担责任。服务按"现状"提供，不保证不间断或无错误。
      </p>

      <h2>七、服务变更与终止</h2>
      <p>我们可能随时修改、暂停或终止部分或全部服务。违反本条款的用户，我们有权暂停或终止其账户。</p>

      <h2>八、法律适用</h2>
      <p>本条款适用中华人民共和国法律。如发生争议，双方应友好协商解决。</p>

      <h2>九、联系我们</h2>
      <p>如有任何问题，请发送邮件至：domaincool@gmail.com</p>
    </main>
  );
}
