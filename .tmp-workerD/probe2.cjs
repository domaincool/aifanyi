/**
 * 产物内容探测 2：中文串在产物里的真实形态 + 列表页场景链接形态。
 */
const fs = require('fs');
const path = require('path');

const f1 = path.join('.next/server/app', 'speak/[scenario]/page.js');
const c1 = fs.readFileSync(f1, 'utf8');
// 找含「英语怎么说」的上下文 —— 数据被编译进 bundle 时可能带引号拼接
const probe1 = c1.indexOf('英语怎么说');
console.log('raw 英语怎么说 idx:', probe1);
if (probe1 >= 0) console.log('ctx:', JSON.stringify(c1.slice(probe1 - 40, probe1 + 60)));
// 找 h1 数据
const probe2 = c1.indexOf('表达指南');
console.log('raw 表达指南 idx:', probe2);
if (probe2 >= 0) console.log('ctx:', JSON.stringify(c1.slice(probe2 - 80, probe2 + 40)));

const f2 = path.join('.next/server/app', 'speak/page.js');
const c2 = fs.readFileSync(f2, 'utf8');
// 列表页是 href=`/speak/${a.slug}` 模板 —— 数据来自 bundle 内 SPEAK_SCENARIOS
const probe3 = c2.indexOf('travel');
console.log('travel idx:', probe3, probe3 >= 0 ? JSON.stringify(c2.slice(probe3 - 40, probe3 + 60)) : '');
console.log('has 天选 data in list bundle (travel data check):', c2.includes('值机托运') || c2.includes('值机'));
