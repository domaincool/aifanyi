const fs = require('fs');
let content = fs.readFileSync('src/app/tools/page.tsx', 'utf-8');

// Update PDF card desc
content = content.replace(
  "desc: '保留原文结构，快速翻译完整 PDF'",
  "desc: 'DeepSeek/GLM/Google 三模型对比，双语对照阅读，支持 DOCX/TXT 下载 · 免费额度'"
);

// Add a tag for 3-model comparison
content = content.replace(
  "name: 'PDF 翻译',",
  "name: 'PDF 翻译', tag: '免费额度 · 三模型对比',"
);

fs.writeFileSync('src/app/tools/page.tsx', content, 'utf-8');
console.log('Tools page updated');

// Check that the tag renders properly
if (content.includes("tag: '免费额度")) {
  console.log('Tag added successfully');
}