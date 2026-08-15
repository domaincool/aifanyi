import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '上线公告 — 爱翻译 · AI翻译',
  description: '爱翻译上线「使用额度」体系：登录即送 500 免费额度，翻译成功才计费，失败自动退回，用量透明可查。',
};

const faqs = [
  {
    q: '我之前没登录也能用 PDF 翻译，现在必须登录吗？',
    a: '是的。登录即可获得 500 免费额度，比之前的每日文件数限制更宽松、更透明。',
  },
  {
    q: '额度用完了怎么办？',
    a: '额度用完后仍可继续使用，按实际用量计费。每次翻译前都会提示预计消耗，不会突然扣费。',
  },
  {
    q: '翻译失败了会扣额度吗？',
    a: '不会。只有翻译成功的部分才计费，失败、取消、中断都会自动退回额度。',
  },
  {
    q: '盲测擂台还免费吗？',
    a: '免费，盲测擂台永远免费。',
  },
];

export default function UpdatesPage() {
  return (
    <main className="updates-page" style={{ maxWidth: 720, margin: '0 auto', padding: '48px 20px 64px' }}>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 8 }}>产品公告 · 2026-08-12</p>
      <h1 style={{ fontSize: 28, margin: '0 0 8px' }}>爱翻译上线「使用额度」体系 🎉</h1>
      <p style={{ color: 'var(--muted)', fontSize: 15, margin: '0 0 24px' }}>
        为了让翻译服务更稳定、更透明地持续运行，爱翻译已上线全新的「使用额度」体系。简单说：放心用，翻译成功才计费，失败自动退回。
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, margin: '0 0 16px' }}>你会看到的变化</h2>

        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', marginBottom: 12, background: 'var(--panel)' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>1. 登录即送 500 免费额度</div>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>新老用户登录后自动到账 500 使用额度（30 天内有效）。额度用完后仍可继续使用，按实际用量计费，用量透明可查。</div>
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', marginBottom: 12, background: 'var(--panel)' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>2. 用量透明，绝不乱扣</div>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>
            每次翻译前都知道大概消耗多少；<strong style={{ color: 'var(--text)' }}>只有翻译成功才扣额度</strong>，失败、取消、任务中断都会自动退回；缓存命中的重复翻译不扣额度。
          </div>
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', marginBottom: 12, background: 'var(--panel)' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>3. 文件翻译需登录使用</div>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>
            PDF / 字幕 / 图片 / 网页 / Word·PPT 翻译现在需要登录后使用（登录即送 500 额度，足够日常使用）。这是为了防止服务被滥用、保证翻译质量与速度。
          </div>
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', background: 'var(--panel)' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>4. 随时查看使用情况</div>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>右上角用户菜单 →「我的额度」，可查看剩余额度、本月用量与最近记录。</div>
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, margin: '0 0 16px' }}>常见问题</h2>
        {faqs.map((f, i) => (
          <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '14px 20px', marginBottom: 10, background: 'var(--panel)' }}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>Q：{f.q}</div>
            <div style={{ fontSize: 14, color: 'var(--muted)' }}>A：{f.a}</div>
          </div>
        ))}
      </section>

      <p style={{ color: 'var(--muted)', fontSize: 14 }}>
        有疑问或建议，欢迎随时反馈。爱翻译，认真翻译。❤️
      </p>
    </main>
  );
}
