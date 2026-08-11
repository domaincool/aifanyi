const fs = require('fs');
let content = fs.readFileSync('src/app/tools/page.tsx', 'utf-8');

// Remove tag (won't render)
content = content.replace(", tag: '免费额度 · 三模型对比'", '');
// Update name with tag info
content = content.replace("name: 'PDF 翻译',", "name: 'PDF 翻译 · 三模型对比',");

fs.writeFileSync('src/app/tools/page.tsx', content, 'utf-8');
console.log('Fixed');