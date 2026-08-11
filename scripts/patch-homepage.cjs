const fs = require('fs');
let content = fs.readFileSync('src/app/page.tsx', 'utf-8');

// Update PDF link: change href and label
content = content.replace(
  '<a href="/tools">PDF翻译</a>',
  '<a href="/tools/pdf-translator">PDF 翻译 · 三模型对比 · 免费额度</a>'
);

// Add a brief subtitle or meta description (if there's a desc area nearby)
// Let's also update the "翻译工具" section to be more descriptive
if (!content.includes('/tools/pdf-translator') || content.includes('<a href="/tools">PDF翻译</a>')) {
  console.log('PDF link not found or old version still present');
} else {
  console.log('PDF link updated');
}

fs.writeFileSync('src/app/page.tsx', content, 'utf-8');
console.log('Done');