import type { Metadata } from 'next';
import CreditClient from './CreditClient';

export const metadata: Metadata = {
  title: '我的使用额度 | 爱翻译',
  description: '爱翻译使用额度：查看剩余额度、本月使用情况与免费额度来源，翻译用量透明可查。',
};

export default function CreditPage() {
  return (
    <div className="tools-page">
      <section className="tools-hero">
        <h1>💳 我的使用额度</h1>
        <p>用量透明，翻译成功才扣费，失败自动退回。</p>
      </section>
      <CreditClient />
    </div>
  );
}
