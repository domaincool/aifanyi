// Re-slug v2-C zh-en entries with pinyin-pro (the v2b-gen slugger is broken; en-zh slugs are fine).
// Content untouched: only slug fields recomputed for pair=zh-en.
const fs = require('fs');
const path = require('path');
const { pinyin } = require(path.join('C:/Users/Administrator/.openclaw-autoclaw/agents/agent-nc6bvi/workspace/.openclaw/tmp/pinyin-lib/node_modules/pinyin-pro'));

const TMP = 'C:/Users/Administrator/.openclaw-autoclaw/agents/agent-nc6bvi/workspace/.openclaw/tmp';
const FULL = path.join(TMP, 'langpair-v2J-full.json');
const PROG = path.join(TMP, 'langpair-v2J-progress.json');

function zhSlug(zh) {
  const tokens = pinyin(zh, { toneType: 'none', type: 'array', v: true });
  const parts = [];
  for (const tok of tokens) {
    const t = tok.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!t) continue;
    // merge adjacent single latin letters (AA制 -> aazhi segment) to keep acronyms readable
    const prev = parts[parts.length - 1];
    if (t.length === 1 && prev && prev.length === 1) parts[parts.length - 1] = prev + t;
    else parts.push(t);
  }
  return parts.join('-');
}

const d = JSON.parse(fs.readFileSync(FULL, 'utf8'));
const seen = new Set();
let fixed = 0, collision = 0;
const SLUG_OVERRIDE = { '抬轿': 'hype-up' };
for (const e of d.entries) {
  if (e.pair !== 'zh-en') continue;
  const s = SLUG_OVERRIDE[e.term] || zhSlug(e.term);
  if (seen.has(s)) { collision++; console.log('COLLISION', e.term, s); }
  seen.add(s);
  if (s !== e.slug) { fixed++; console.log('SLUG', e.term, ':', JSON.stringify(e.slug), '->', s); }
  e.slug = s;
}
// validate all entries
let bad = 0;
for (const e of d.entries) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(e.slug)) { bad++; console.log('STILL_BAD', e.pair, e.term, e.slug); }
  if (e.pair === 'zh-en' && e.searchIntentType !== 'how_to_say') { bad++; console.log('INTENT', e.term); }
  if (e.pair === 'en-zh' && e.searchIntentType !== 'meaning') { bad++; console.log('INTENT', e.term); }
}
d.meta.slugStrategy = 'zh=pinyin-pro (toneless, v), en=slugify';
d.meta.pairCounts = d.entries.reduce((a, e) => { a[e.pair] = (a[e.pair] || 0) + 1; return a; }, {});
fs.writeFileSync(FULL, JSON.stringify(d, null, 1), 'utf8');
// sync prog so future repair runs keep the good slugs
const prog = JSON.parse(fs.readFileSync(PROG, 'utf8'));
for (const k of Object.keys(prog.entries)) {
  const rec = prog.entries[k];
  const zh = d.entries.find(x => x.pair === 'zh-en' && x.term === rec.zh.term);
  if (zh) rec.zh.slug = zh.slug;
}
fs.writeFileSync(PROG, JSON.stringify(prog), 'utf8');
// rebuild slug list
fs.writeFileSync(path.join(TMP, 'v2c-slugs.txt'), d.entries.map(e => e.slug + '|' + e.term.replace(/\|/g, '/')).join('\n'), 'utf8');
console.log('DONE fixed=' + fixed + ' collisions=' + collision + ' bad=' + bad + ' total=' + d.entries.length);
