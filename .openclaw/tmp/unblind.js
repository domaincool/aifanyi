const fs = require('fs');
const dir = 'C:\\Users\\Administrator\\.openclaw-autoclaw\\agents\\agent-nc6bvi\\workspace\\handoff\\';
const blind = JSON.parse(fs.readFileSync(dir + 'pdf-blindtest-50-20260810.json', 'utf8'));
const scoring = JSON.parse(fs.readFileSync(dir + 'pdf-blindtest-scoring-20260810.json', 'utf8'));

const byModel = {}; // model -> {A,B,C}
for (const it of blind.items) {
  const sc = scoring.ratings[it.id];
  for (const pos of ['A', 'B', 'C']) {
    const m = it[pos].model;
    const g = sc[pos];
    if (!byModel[m]) byModel[m] = { A: 0, B: 0, C: 0 };
    byModel[m][g]++;
  }
}
console.log('=== 模型维度评级（150 次）===');
for (const [m, v] of Object.entries(byModel)) {
  const total = v.A + v.B + v.C;
  console.log(`${m.padEnd(10)} A:${String(v.A).padStart(3)} (${(v.A / total * 100).toFixed(1)}%)  B:${String(v.B).padStart(3)} (${(v.B / total * 100).toFixed(1)}%)  C:${String(v.C).padStart(3)} (${(v.C / total * 100).toFixed(1)}%)`);
}

console.log('\n=== C 级问题归属 ===');
for (const se of scoring.meta.seriousErrors) {
  const it = blind.items.find((x) => x.id === se.id);
  const m = it[se.pos].model;
  console.log(`${se.id} (${se.pos}位=${m}): ${se.issue}`);
}

console.log('\n=== B 级按模型 ===');
for (const [m, v] of Object.entries(byModel)) console.log(`${m.padEnd(10)} B:${v.B}`);

console.log('\n=== 各模型表现最好的分类（A 率）===');
const catByModel = {};
for (const it of blind.items) {
  const sc = scoring.ratings[it.id];
  for (const pos of ['A', 'B', 'C']) {
    const m = it[pos].model;
    const key = m + '|' + it.category;
    if (!catByModel[key]) catByModel[key] = { A: 0, n: 0 };
    catByModel[key].n++;
    if (sc[pos] === 'A') catByModel[key].A++;
  }
}
for (const m of Object.keys(byModel)) {
  const cats = Object.entries(catByModel).filter(([k]) => k.startsWith(m + '|')).map(([k, v]) => [k.split('|')[1], v.A / v.n]).sort((a, b) => b[1] - a[1]);
  console.log(m + ':', cats.map(([c, r]) => `${c}(${(r * 100).toFixed(0)}%)`).join(' '));
}