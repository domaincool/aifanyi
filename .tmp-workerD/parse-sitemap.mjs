import fs from 'fs';
const xml = fs.readFileSync('.tmp-workerD/content-sitemap.xml', 'utf8');
const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
const groups = {};
for (const u of locs) {
  const p = u.replace('https://aifanyi.com', '');
  const seg = '/' + (p.split('/')[1] || '') + (p.split('/')[2] && p.split('/')[1] !== 'meme' && !['menu','travel','life','understand','tools','translate'].includes(p.split('/')[1]) ? '' : '/' + (p.split('/')[2] || ''));
  const key = p.split('/').slice(0, 3).join('/');
  groups[key] = groups[key] || [];
  groups[key].push(p);
}
for (const k of Object.keys(groups).sort()) {
  console.log('##', k, groups[k].length);
}
console.log('=== TRAVEL ===');
console.log(groups['/travel'].join('\n'));
console.log('=== MEME sample (first 400) ===');
console.log(locs.filter(u=>u.includes('/meme/')).length + ' meme urls');
fs.writeFileSync('.tmp-workerD/urls.json', JSON.stringify({ locs, groups }, null, 1));
