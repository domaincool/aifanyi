const fs = require('fs');
const p = 'src/app/sitemap.ts';
let s = fs.readFileSync(p, 'utf8');
const NL = s.includes('\r\n') ? '\r\n' : '\n';

// 1) import 静态数据（Speak 场景 + Culture 文章）
const impOld = "import { TRANSLATE_PAIRS } from '@/lib/translate-pairs';";
const impNew = "import { TRANSLATE_PAIRS } from '@/lib/translate-pairs';" + NL +
"import { SPEAK_SCENARIOS } from '@/lib/content/speak-scenarios';" + NL +
"import { CULTURE_ARTICLES } from '@/lib/content/culture-articles';";
if (!s.includes(impOld)) { console.error('IMP MISS'); process.exit(1); }
s = s.replace(impOld, impNew);

// 2) culture 列表行后追加 speak 列表/详情 + culture 详情
const anchor = "    { url: `${BASE}/culture`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },";
if (!s.includes(anchor)) { console.error('ANCHOR MISS'); process.exit(1); }
const addition = anchor + NL +
"    { url: `${BASE}/speak`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 }," + NL +
"    ...SPEAK_SCENARIOS.map((s) => ({ url: `${BASE}/speak/${s.slug}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.8 }))," + NL +
"    ...CULTURE_ARTICLES.map((a) => ({ url: `${BASE}/culture/${a.slug}`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.7 })),";
s = s.replace(anchor, addition);

fs.writeFileSync(p, s);
console.log('sitemap patched, len', s.length);
