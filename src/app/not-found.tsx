import Link from 'next/link';

/** 品牌化 404（蓝图 P0：原为 Next 默认英文页） */
export default function NotFound() {
  return (
    <div className="nf-page">
      <div className="nf-card">
        <div className="nf-code">404</div>
        <h1>这一页翻不过去了</h1>
        <p className="nf-sub">页面不存在、已下线或链接有误。不过翻译还在——</p>
        <div className="nf-actions">
          <Link href="/" className="nf-btn primary">回首页翻译</Link>
          <Link href="/meme" className="nf-btn">逛网络用语库</Link>
          <Link href="/tools" className="nf-btn">用翻译工具</Link>
        </div>
        <p className="nf-hint">热门：PDF 翻译 · 字幕翻译 · 英语翻译成中文 · <Link href="/blindtest">盲测擂台</Link></p>
      </div>
    </div>
  );
}
