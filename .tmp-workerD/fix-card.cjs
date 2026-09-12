const fs = require('fs');
const p = 'src/app/speak/[scenario]/page.tsx';
let s = fs.readFileSync(p, 'utf8');

const oldCard = `function EntryCard({ e }: { e: SpeakEntry }) {
  const inner = (
    <>
      <div className="term">{e.term}</div>
      <div className="tr" style={{ color: 'var(--accent2)', fontWeight: 600 }}>{e.translation}</div>
      <div className="mn">{e.meaning}</div>
      {e.example ? (
        <div className="mn" style={{ marginTop: 8 }}>
          {e.example}
          {e.exampleZh ? <span style={{ display: 'block', marginTop: 2 }}>{e.exampleZh}</span> : null}
        </div>
      ) : null}
    </>
  );
  // 词条类表达卡：链接进词条页吃内链长尾；纯表达卡（无 slug）静态展示
  if (e.slug && e.tags && e.tags.length > 0) {
    return (
      <Link className="entry-card" href={\`/meme/\${e.slug}\`}>
        {inner}
      </Link>
    );
  }
  return <div className="entry-card">{inner}</div>;
}`;

const newCard = `function EntryCard({ e }: { e: SpeakEntry }) {
  // 短语型表达卡（native/zh/note）：静态句卡
  if (e.native) {
    return (
      <div className="entry-card">
        <div className="term">{e.term}</div>
        <div className="tr" style={{ color: 'var(--accent2)', fontWeight: 600 }}>{e.native}</div>
        <div className="mn">{e.zh}</div>
        {e.note ? <div className="mn" style={{ marginTop: 6, opacity: 0.8 }}>{e.note}</div> : null}
      </div>
    );
  }
  // 词条型表达卡：链接进词条页吃内链长尾
  const inner = (
    <>
      <div className="term">{e.term}</div>
      <div className="tr" style={{ color: 'var(--accent2)', fontWeight: 600 }}>{e.translation}</div>
      <div className="mn">{e.meaning}</div>
      {e.example ? (
        <div className="mn" style={{ marginTop: 8 }}>
          {e.example}
          {e.exampleZh ? <span style={{ display: 'block', marginTop: 2 }}>{e.exampleZh}</span> : null}
        </div>
      ) : null}
    </>
  );
  if (e.slug && e.tags && e.tags.length > 0) {
    return (
      <Link className="entry-card" href={\`/meme/\${e.slug}\`}>
        {inner}
      </Link>
    );
  }
  return <div className="entry-card">{inner}</div>;
}`;

if (!s.includes(oldCard)) { console.error('CARD MISS'); process.exit(1); }
s = s.replace(oldCard, newCard);

// CTA 锚点 onClick={undefined} 移除（多余的 prop）
s = s.replace('<a className="btn primary tool-cta" href={`/#translator`} onClick={undefined}>', '<a className="tool-cta" href="/#translator" style={{ background: \'var(--accent)\', color: \'#fff\', fontWeight: 600 }}>');

fs.writeFileSync(p, s);
console.log('entry card fixed');
