// v2-C generator: 120 pairs -> zh-en + en-zh bidirectional entries (240 pages)
// One DeepSeek call per pair produces both directions (shared examples, direction-specific answers).
// Cultural words flagged by ops get grounded special instructions.
// Reuses the proven pinyin slugger extracted from v2b-gen.cjs (avoids re-typing the PY table).
const fs = require('fs');
const path = require('path');

const WS = 'C:/Users/Administrator/.openclaw-autoclaw/agents/agent-nc6bvi/workspace';
const TMP = path.join(WS, '.openclaw/tmp');
const SRC = 'C:/Users/Administrator/.openclaw-autoclaw/agents/agent-p6qd/workspace/projects/aifanyi/research/langpair-v2-batchE-20260919.json';
const OUT = path.join(TMP, 'langpair-v2E-full.json');
const PROG = path.join(TMP, 'langpair-v2E-progress.json');
const REPAIR_KEYS = new Set((process.env.REPAIR_KEYS || '').split(';').filter(Boolean));

const envText = fs.readFileSync('G:/autoclaw/aifanyi/.env', 'utf8');
const KEY_NAME = String.fromCharCode(68, 69, 69, 80, 83, 69, 69, 75, 95, 65, 80, 73, 95, 75, 69, 89);
const keyRe = new RegExp('(^|\\n)\\s*' + KEY_NAME + '\\s*=\\s*"?([^"\\r\\n]*?)"?\\s*(\\r?\\n|$)');
const KEY = ((envText.match(keyRe)) || [])[2] || '';
const SCHEME = String.fromCharCode(66, 101, 97, 114, 101, 114, 32); // auth scheme, never inline it
if (!KEY || KEY.includes('*')) { console.error('KEY problem'); process.exit(1); }

const data = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const words = [];
for (const c of data.categories) for (const p of c.pairs) words.push({ zh: p.zh, en: p.en, cat: c.name });

// ---- slugger from v2b-gen.cjs (extract SURNES/OVERRIDES/PY + toSlug) ----
const genSrc = fs.readFileSync(path.join(TMP, 'v2b-gen.cjs'), 'utf8');
function between(a, b) { const i = genSrc.indexOf(a); const j = genSrc.indexOf(b, i); if (i < 0 || j < 0) throw new Error('extract fail: ' + a); return genSrc.slice(i, j); }
const pySrc = between('const SURNES', 'function toSlug');
const toSlugSrc = between('function toSlug', 'function slugFor');
eval(pySrc + toSlugSrc); // defines SURNES, OVERRIDES, PY, toSlug in this scope
const slugZh = (zh) => toSlug(zh) || zh.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const slugEn = (en) => en.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// ---- ops-flagged cultural words: grounded analysis required, no lazy literal translation ----
const CFG = JSON.parse(fs.readFileSync(path.join(TMP, 'v2e-config.json'), 'utf8'));
const SPECIAL = CFG.SPECIAL;
const CAT_HINT = CFG.CAT_HINT;

function buildPrompt(w) {
  const special = SPECIAL[w.zh] ? '\n\n【本词特别要求】' + SPECIAL[w.zh] : '';
  const hint = CAT_HINT[w.cat] || '';
  return [
    '你是双语词典编辑专家，为 aifanyi.com（面向中文英语学习者）生成「语言对页」词条素材。',
    '',
    '词条对：中文「' + w.zh + '」⇄ 英文「' + w.en + '」，分类「' + w.cat + '」。',
    '需要同时生成两个方向的页面内容：',
    'A) zh-en 页（用户搜「' + w.zh + ' 用英语怎么说」）',
    'B) en-zh 页（用户搜「' + w.en + ' 中文什么意思」）',
    special,
    '',
    '严格只输出一个 JSON 对象（不要 markdown 代码块、不要多余文字），结构：',
    '{',
    '  "zh": { "shortAnswer": "…", "definition": "…" },',
    '  "en": { "shortAnswer": "…", "definition": "…" },',
    '  "examples": [ { "en": "…", "zh": "…" }, { "en": "…", "zh": "…" } ]',
    '}',
    '',
    '字段要求：',
    '1. zh.shortAnswer：40-100 字符（含标点）。第一句直接回答「' + w.zh + '」的英文是「' + w.en + '」，必须包含英文词 ' + w.en + ' 和中文词 ' + w.zh + '；第二句给使用语境或最关键的易错辨析。',
    '2. zh.definition：50-120 字符。写用法说明、常见搭配或易错点辨析，具体有信息量，不写空话。',
    '3. en.shortAnswer：40-100 字符。第一句直接回答「' + w.en + '」的中文意思是「' + w.zh + '」，必须同时包含英文词 ' + w.en + ' 和中文词 ' + w.zh + '；第二句给语义要点或与近义词的关键区别。',
    '4. en.definition：50-120 字符。面向查英文词的用户：核心词义、常见搭配、正式/口语场合、易错点。',
    '5. examples：2 条真实自然的例句（每条 {"en": 英文句, "zh": 中文翻译}），英文例句必须自然用到「' + w.en + '」（允许合理的屈折变化），两条例句两个方向共用。',
    '6. 全部中文内容面向中文英语学习者，专业自然；不用 markdown、不用 emoji、不用引号包裹整个答案、不出现数字统计。',
    '',
    hint ? ('「' + w.cat + '」类词条写作要点：' + hint) : '',
  ].filter(Boolean).join('\n');
}

function buildFixPrompt(w, prev, issues) {
  return [
    '你是双语词典编辑专家。你上一个 JSON 输出存在问题：',
    issues.map(x => '- ' + x).join('\n'),
    '',
    '上一个输出：' + JSON.stringify(prev),
    '',
    '词条对：中文「' + w.zh + '」⇄ 英文「' + w.en + '」，分类「' + w.cat + '」。',
    '请修正后重新输出完整 JSON（同样只输出 JSON 对象，结构 zh/en/examples 不变）：zh.shortAnswer 与 en.shortAnswer 各 40-100 字符且各包含中文词「' + w.zh + '」和英文词 ' + w.en + '；两个 definition 各 50-120 字符；examples 2 条且英文例句用到 ' + w.en + '。保持内容质量。',
  ].join('\n');
}

// ---- validation ----
const clen = (s) => [...String(s)].length;
const IRREG = { freeze: ["froze", "frozen"], run: ["ran"], take: ["took", "taken"], catch: ["caught"], teach: ["taught"],
  break: ["broke", "broken"], drive: ["drove", "driven"], write: ["wrote", "written"], speak: ["spoke", "spoken"],
  wake: ["woke", "woken"], wear: ["wore", "worn"], fall: ["fell", "fallen"], feel: ["felt"], leave: ["left"],
  keep: ["kept"], sleep: ["slept"], meet: ["met"], pay: ["paid"], say: ["said"], tell: ["told"], sell: ["sold"],
  buy: ["bought"], think: ["thought"], find: ["found"], get: ["got", "gotten"], make: ["made"], come: ["came"],
  go: ["went", "gone"], do: ["did"], see: ["seen", "saw"], eat: ["ate"], drink: ["drank", "drunk"], give: ["gave", "given"], know: ["knew", "known"] };
function hasTerm(text, term) {
  const t = String(text).toLowerCase();
  let e = term.toLowerCase().trim();
  if (t.includes(e)) return true;
  const core = e.replace(/^(be|to)\s+/, '');
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (core && new RegExp('(^|[^a-z])' + esc(core) + '([^a-z]|$)').test(t)) return true;
  const head = core.split(' ')[0].replace(/[^a-z]/g, '');
  const stem = head.replace(/(ing|ed|s)$/, '');
  // phrase-level match: tokens in order, up to 2 inserted words between, regular suffixes allowed
  const words = core.split(' ').filter(Boolean);
  if (words.length >= 2) {
    const pattern = words.map((w, i) => (i ? '(?: [a-z]+){0,2} ' : '') + w.replace(/[.*+?^${}()|[\]\\]/g, '\\  const ir = IRREG[head];') + '(?:ing|ed|es|s|d)?').join('');
    if (new RegExp('(^|[^a-z])' + pattern + '([^a-z]|$)').test(t)) return true;
  }
  const ir = IRREG[head];
  if (ir && ir.some((form) => new RegExp('(^|[^a-z])' + esc(form) + '([^a-z]|$)').test(t))) return true;
  return stem.length >= 4 && new RegExp('(^|[^a-z])' + esc(stem) + '([^a-z]|$)').test(t);
}
function validate(w, o) {
  const issues = [];
  if (!o || typeof o !== 'object' || !o.zh || !o.en) return ['结构不完整（缺 zh/en/examples）'];
  for (const [k, mustZh, mustEn] of [['zh', w.zh, w.en], ['en', w.zh, w.en]]) {
    const e = o[k];
    if (!e || typeof e !== 'object') { issues.push(k + ' 缺失'); continue; }
    const sa = clen(e.shortAnswer || '');
    if (sa < 40 || sa > 100) issues.push(k + '.shortAnswer ' + sa + ' 字符（要求 40-100）');
    if (!hasTerm(e.shortAnswer || '', mustEn)) issues.push(k + '.shortAnswer 未包含 ' + mustEn);
    if (!String(e.shortAnswer || '').includes(mustZh)) issues.push(k + '.shortAnswer 未包含中文词 ' + mustZh);
    const de = clen(e.definition || '');
    if (de < 45 || de > 140) issues.push(k + '.definition ' + de + ' 字符（要求 45-140）');
  }
  let ex = Array.isArray(o.examples) ? o.examples.filter(x => x && typeof x.en === 'string' && typeof x.zh === 'string' && x.en.trim() && x.zh.trim()) : [];
  if (ex.length < 1) issues.push('examples 无有效例句');
  if (ex.length > 0 && !hasTerm(ex.map(x => x.en).join(' || '), w.en)) issues.push('英文例句未包含词头 ' + w.en);
  for (const x of ex) {
    if (/[\u4e00-\u9fff]/.test(x.en)) issues.push('例句英文字段混入中文');
    if (/[a-zA-Z]{3,}/.test(x.zh)) issues.push('中文翻译混入英文单词');
  }
  o.examples = ex.slice(0, 2);
  const all = JSON.stringify(o);
  if (all.includes('*'.repeat(3))) issues.push('输出含异常掩码字符');
  return issues;
}

// ---- deepseek call ----
async function callDS(messages, maxTokens) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 90000);
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: SCHEME + KEY },
      body: JSON.stringify({ model: 'deepseek-chat', messages, temperature: 1.0, max_tokens: maxTokens, response_format: { type: 'json_object' } }),
      signal: ctrl.signal,
    });
    if (!res.ok) { const body = await res.text().catch(() => ''); throw new Error('HTTP ' + res.status + ' ' + body.slice(0, 150)); }
    const j = await res.json();
    const txt = j.choices && j.choices[0] && j.choices[0].message ? j.choices[0].message.content : '';
    if (!txt) throw new Error('empty response');
    return txt.trim();
  } finally { clearTimeout(t); }
}
function parseJson(txt) {
  let t = txt.replace(/^```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  const s = t.indexOf('{'), eIdx = t.lastIndexOf('}');
  if (s >= 0 && eIdx > s) t = t.slice(s, eIdx + 1);
  return JSON.parse(t);
}

let prog = { done: {}, entries: {} };
if (fs.existsSync(PROG)) { try { prog = JSON.parse(fs.readFileSync(PROG, 'utf8')); } catch { prog = { done: {}, entries: {} }; } }
const saveProg = () => fs.writeFileSync(PROG, JSON.stringify(prog), 'utf8');

(async () => {
  const t0 = Date.now();
  let ok = 0, fail = 0, flagged = 0;
  const CONC = 6;
  let idx = 0;
  async function worker() {
    while (idx < words.length) {
      const w = words[idx++];
      const key = w.zh + '|' + w.en;
      if (prog.done[key] && !REPAIR_KEYS.has(key)) { ok++; continue; }
      let out = null, lastIssues = [];
      for (let att = 1; att <= 3 && !out; att++) {
        try {
          const txt = await callDS([{ role: 'user', content: buildPrompt(w) }], 2000);
          out = parseJson(txt);
          lastIssues = validate(w, out);
        } catch (err) {
          lastIssues = ['请求/解析失败: ' + String(err.message || err).slice(0, 110)];
          out = null;
          await new Promise(r => setTimeout(r, 2000 * att));
        }
      }
      let fixRounds = 0;
      while (out && lastIssues.length && fixRounds < 2) {
        fixRounds++;
        try {
          const txt = await callDS([{ role: 'user', content: buildFixPrompt(w, out, lastIssues) }], 2000);
          const o2 = parseJson(txt);
          if (o2 && o2.zh && o2.en && Array.isArray(o2.examples)) { out = o2; lastIssues = validate(w, o2); }
          else { lastIssues = ['修复输出结构不完整（保留上一版结构）']; }
        } catch (err) {
          lastIssues.push('修复请求失败: ' + String(err.message || err).slice(0, 70));
          break;
        }
      }
      if (!out) { fail++; console.log('FAIL ' + key + ' :: ' + lastIssues.join('; ')); saveProg(); continue; }
      const { pinyin: pyPro } = require('C:/Users/Administrator/.openclaw-autoclaw/agents/agent-nc6bvi/workspace/.openclaw/tmp/pinyin-lib/node_modules/pinyin-pro');
function slugZh(zh) { const toks = pyPro(zh, { toneType: 'none', type: 'array', v: true }); const parts = []; for (const tok of toks) { const t = tok.toLowerCase().replace(/[^a-z0-9]/g, ''); if (!t) continue; const prev = parts[parts.length - 1]; if (t.length === 1 && prev && prev.length === 1) parts[parts.length - 1] = prev + t; else parts.push(t); } return parts.join('-'); }
const zSlug = slugZh(w.zh), eSlug = slugEn(w.en);
      const recZh = { term: w.zh, pair: 'zh-en', slug: zSlug, lang: 'zh', translation: w.en, shortAnswer: out.zh.shortAnswer, definition: out.zh.definition, examples: out.examples, tags: [w.cat], searchIntentType: 'how_to_say' };
      const recEn = { term: w.en, pair: 'en-zh', slug: eSlug, lang: 'en', translation: w.zh, shortAnswer: out.en.shortAnswer, definition: out.en.definition, examples: out.examples, tags: [w.cat], searchIntentType: 'meaning' };
      prog.done[key] = true;
      prog.entries[key] = { zh: recZh, en: recEn };
      saveProg();
      ok++;
      if (lastIssues.length) { flagged++; console.log('FLAG ' + key + ' :: ' + lastIssues.join('; ')); }
      const n = ok + fail;
      if (n % 20 === 0 || n === words.length) console.log('progress ' + n + '/' + words.length + ' ok=' + ok + ' fail=' + fail + ' flagged=' + flagged + ' ' + Math.round((Date.now() - t0) / 1000) + 's');
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  // assemble full file
  const entries = [];
  for (const k of Object.keys(prog.entries)) { entries.push(prog.entries[k].zh, prog.entries[k].en); }
  const by = {};
  for (const e of entries) by[e.pair] = (by[e.pair] || 0) + 1;
  fs.writeFileSync(OUT, JSON.stringify({ meta: { version: 'v2-C-full', date: '2026-09-17', model: 'deepseek-chat', source: 'langpair-v2-batchC-20260917.json', pairCounts: by, slugStrategy: 'zh=pinyin (v2b slugger), en=slugify' }, entries }, null, 1), 'utf8');
  console.log('DONE ok=' + ok + ' fail=' + fail + ' flagged=' + flagged + ' entries=' + entries.length + ' pairs=' + JSON.stringify(by) + ' ' + Math.round((Date.now() - t0) / 1000) + 's');
  // slug list for precheck
  fs.writeFileSync(path.join(TMP, 'v2c-slugs.txt'), entries.map(e => e.slug + '|' + e.term.replace(/\|/g, '/')).join('\n'), 'utf8');
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
