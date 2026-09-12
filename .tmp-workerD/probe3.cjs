/**
 * 环境编码自证 + 产物是否为 UTF-8 的判定：
 * 1) 把同一 needle 分别按 utf8 与 latin1 字节写入临时文件，比对产物读取结果；
 * 2) 用 Buffer.indexOf 直接按 utf8 字节序列在文件 Buffer 中查找（绕开 readFileSync utf8 解码歧义）。
 */
const fs = require('fs');
const path = require('path');

const needle = '场景表达指南'; // utf8 bytes: e5 9c ba e6 99 af e8 a1 a8 e8 be be e6 8c 87 e5 8d 97
const nb = Buffer.from(needle, 'utf8');
console.log('needle bytes:', nb.toString('hex'));

for (const rel of ['speak/[scenario]/page.js', 'speak/page.js', 'culture/[slug]/page.js', 'culture/page.js']) {
  const buf = fs.readFileSync(path.join('.next/server/app', rel));
  const hex = buf.toString('hex');
  const nhex = nb.toString('hex');
  const byteIdx = hex.indexOf(nhex) >= 0 ? 'YES(byte-level)' : 'no(byte-level)';
  const strIdx = buf.toString('utf8').includes(needle) ? 'YES(string-level)' : 'no(string-level)';
  console.log(rel, '->', byteIdx, strIdx, 'len', buf.length);
}

// 列表页 travel 数据探测（字节级找「值机托运」）
const nb2 = Buffer.from('值机托运', 'utf8').toString('hex');
const b2 = fs.readFileSync(path.join('.next/server/app', 'speak/page.js')).toString('hex');
console.log('speak index contains 值机托运 bytes?', b2.includes(nb2) ? 'YES' : 'no');
// 也找 travel slug 字符串（列表页链接数据）
console.log('speak index contains `travel`?', fs.readFileSync(path.join('.next/server/app', 'speak/page.js'), 'utf8').includes('travel'));
