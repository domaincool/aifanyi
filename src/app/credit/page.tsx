import type { Metadata } from 'next';
import CreditClient from './CreditClient';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  path: '/credit',
  title: "我的积分 | 爱翻译",
  description: "爱翻译积分中心：查看剩余积分、本月使用与积分来源，翻译用量透明可查。",
  ogType: 'list',
});

export default function CreditPage() {
  return (
    <div className="tools-page">
      <section className="tools-hero">
        <h1>💳 我的积分</h1>
        <p>用量透明，翻译成功才扣费，失败自动退回。</p>
      </section>
      <CreditClient />
    </div>
  );
}
