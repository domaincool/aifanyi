import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  path: '/updates',
  title: "上线公告 — 爱翻译 · AI翻译",
  description: "爱翻译上线「使用积分」体系：翻译成功才计费，失败自动退回，用量透明可查。",
  ogType: 'list',
});

const faqs = [
  {
    q: '我之前没登录也能用 PDF 翻译，现在必须登录吗？',
    a: '可以直接使用，无需登录；需要保存记录或翻译更大的文件时再登录即可。',
  },
  {
    q: '积分用完了怎么办？',
    a: '积分用完后可以充值继续使用；也可以等次日免费次数恢复。全程按实际用量计费，每次翻译前都会提示预计用量，不会突然扣费。',
  },
  {
    q: '翻译失败了会扣积分吗？',
    a: '不会。只有翻译成功的部分才计费，失败、取消、中断都会自动退回积分。',
  },
  {
    q: '盲测擂台还免费吗？',
    a: '免费，擂台投票不消耗积分。',
  },
];

export default function UpdatesPage() {
  return (
    <main className="updates-page" style={{ maxWidth: 720, margin: '0 auto', padding: '48px 20px 64px' }}>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 8 }}>产品公告 · 2026-08-12</p>
      <h1 style={{ fontSize: 28, margin: '0 0 8px' }}>爱翻译上线「使用积分」体系 🎉</h1>
      <p style={{ color: 'var(--muted)', fontSize: 15, margin: '0 0 24px' }}>
        为了让翻译服务更稳定、更透明地持续运行，爱翻译已上线全新的「使用积分」体系。简单说：放心用，翻译成功才计费，失败自动退回。
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, margin: '0 0 16px' }}>你会看到的变化</h2>

        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', marginBottom: 12, background: 'var(--panel)' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>1. 登录即送 500 积分</div>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>新老用户登录后自动到账 500 积分（30 天内有效）。按实际用量计费，用量透明可查；积分用完后可充值或等待次日免费次数恢复。</div>
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', marginBottom: 12, background: 'var(--panel)' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>2. 用量透明，绝不乱扣</div>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>
            每次翻译前都知道大概消耗多少；<strong style={{ color: 'var(--text)' }}>只有翻译成功才扣积分</strong>，失败、取消、任务中断都会自动退回；文本翻译、AI 润色、怎么说等带缓存的场景，命中缓存不扣积分。
          </div>
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', marginBottom: 12, background: 'var(--panel)' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>3. 文件翻译的登录要求</div>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>
            PDF / 字幕翻译无需登录即可使用；图片 / 网页 / Word·PPT 翻译需登录后使用（登录即送 500 积分）。登录后翻译记录云端保存，每天可翻译的文件也更多。
          </div>
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', background: 'var(--panel)' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>4. 随时查看使用情况</div>
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>右上角用户菜单 →「我的积分」，可查看剩余积分、本月用量与最近记录。</div>
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
