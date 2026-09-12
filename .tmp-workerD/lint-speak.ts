import { SPEAK_SCENARIOS } from '../src/lib/content/speak-scenarios';
import fs from 'fs';

// 1. 结构自检：每个场景有 top10、h1 模板正确、slug 白名单正确
const expect = ['travel', 'business', 'ecommerce', 'work', 'social', 'dating', 'study'];
console.log('slugs:', SPEAK_SCENARIOS.map((s) => s.slug).join(','));
if (SPEAK_SCENARIOS.map((s) => s.slug).join(',') !== expect.join(',')) throw new Error('slug order mismatch');
for (const s of SPEAK_SCENARIOS) {
  if (!s.h1.includes('英语怎么说')) throw new Error('h1 template bad: ' + s.slug);
  if (s.top10.length !== 10) throw new Error('top10 != 10: ' + s.slug + ' got ' + s.top10.length);
  if (!s.sections.length) throw new Error('no sections: ' + s.slug);
}
// 2. 内链校验：链接必须存在于线上 sitemap（urls.json）或本站已知静态路由
const locs: string[] = JSON.parse(fs.readFileSync('.tmp-workerD/urls.json', 'utf8')).map((u: string) => u.replace('https://aifanyi.com', ''));
const live = new Set(locs);
const staticAllowed = new Set(['/', '/arena', '/meme', '/meme/tag/%E8%81%8C%E5%9C%BA', '/meme/tag/%E7%A4%BE%E4%BA%A4', '/meme/tag/%E6%81%8B%E7%88%B1', '/meme/tag/%E8%B4%AD%E7%89%A9', '/idioms', '/ecommerce', '/voice', '/tools/pdf-translator', '/tools/doc-translator', '/tools/ai-polish', '/tools/web-translator']);
let bad = 0;
for (const s of SPEAK_SCENARIOS) {
  const hrefs: string[] = [];
  for (const sec of s.sections) for (const l of sec.links || []) hrefs.push(l.href);
  for (const h of hrefs) {
    if (!live.has(h) && !staticAllowed.has(h)) { console.log('BAD LINK', s.slug, h); bad++; }
  }
}
console.log('bad links:', bad);
if (bad > 0) process.exit(1);
console.log('SPEAK DATA OK');
