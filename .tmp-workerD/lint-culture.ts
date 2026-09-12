import { CULTURE_ARTICLES } from '../src/lib/content/culture-articles';
import fs from 'fs';

const locs: string[] = JSON.parse(fs.readFileSync('.tmp-workerD/urls.json', 'utf8')).map((u: string) => u.replace('https://aifanyi.com', ''));
const live = new Set(locs);
const staticAllowed = new Set(['/', '/arena', '/meme', '/understand/slang', '/untranslatable', '/culture', '/life', '/speak/work', '/speak/business', '/speak/social', '/tools/image-translator', '/tools/web-translator']);
let bad = 0;
for (const a of CULTURE_ARTICLES) {
  if (a.points.length < 3 || a.points.length > 5) { console.log('POINTS RANGE BAD', a.slug, a.points.length); bad++; }
  if (a.dialogues.length !== 2) { console.log('DIALOGUES != 2', a.slug); bad++; }
  const hrefs: string[] = [];
  for (const p of a.points) for (const l of p.links || []) hrefs.push(l.href);
  for (const l of a.relatedLinks) hrefs.push(l.href);
  for (const h of hrefs) {
    if (!live.has(h) && !staticAllowed.has(h)) { console.log('BAD LINK', a.slug, h); bad++; }
  }
}
console.log('articles:', CULTURE_ARTICLES.length, 'bad:', bad);
if (bad > 0) process.exit(1);
console.log('CULTURE DATA OK');
