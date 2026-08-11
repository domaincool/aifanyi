const fs = require('fs');
const envPath = 'G:\\autoclaw\\aifanyi\\.env';
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, '$1');
}
const base = 'G:\\autoclaw\\aifanyi\\.openclaw\\tmp\\blindtest\\src\\lib\\translator\\providers\\';
const p = require(base + 'deepseek.js');
const g = require(base + 'glm.js');
const o = require(base + 'google.js');
(async () => {
  const req = { text: 'Hello world, this is a test.', sourceLang: 'en', targetLang: 'zh', scenario: 'pdf' };
  const r = await Promise.all([
    new p.DeepSeekProvider().translate(req),
    new g.GlmProvider().translate(req),
    new o.GoogleTranslateProvider().translate(req),
  ]);
  for (const x of r) console.log(x.model, '|err:', x.error || '(none)', '|lat:', x.latencyMs + 'ms', '|text:', (x.text || '').slice(0, 30));
})();