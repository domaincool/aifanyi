/**
 * 产物内容探测：中文在 page.js 里是什么形态？（unicode 转义 / 原文 / 编译拆分）
 */
const fs = require('fs');
const path = require('path');

const f1 = path.join('.next/server/app', 'speak/[scenario]/page.js');
const c1 = fs.readFileSync(f1, 'utf8');
console.log('file len:', c1.length);
console.log('has \\u escapes?', c1.includes('\\u'));
const i = c1.indexOf('\\u');
if (i >= 0) console.log('sample \\u ctx:', JSON.stringify(c1.slice(i, i + 60)));

// unicode 转义形式的「场景表达指南」= \u573a\u666f\u8868\u8fbe\u6307\u5357
console.log('has escaped 场景表达指南?', c1.includes('\\u573a\\u666f\\u8868\\u8fbe\\u6307\\u5357'));

// 纯 ascii 需求
console.log('has ld+json?', c1.includes('application/ld+json'));
console.log('has Article?', c1.includes('"Article"'));
console.log('has /meme/?', c1.includes('/meme/'));
console.log('has /arena?', c1.includes('/arena'));
console.log('has /#translator?', c1.includes('/#translator'));

const f2 = path.join('.next/server/app', 'speak/page.js');
const c2 = fs.readFileSync(f2, 'utf8');
console.log('speak index has /speak/travel?', c2.includes('/speak/travel'));
console.log('speak index len:', c2.length);
const j = c2.indexOf('/speak/');
console.log('first /speak/ ctx:', j >= 0 ? JSON.stringify(c2.slice(Math.max(0, j - 60), j + 40)) : 'NONE');
