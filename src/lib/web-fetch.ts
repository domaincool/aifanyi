/**
 * 网页抓取 + 正文提取（零依赖）
 * SSRF 防护：仅 http/https + 拒绝内网地址；15s 超时；响应 ≤2MB
 */

const MAX_RESPONSE = 4 * 1024 * 1024;
const MAX_PARAGRAPHS = 50;

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (/^127\./.test(h) || /^0\.0\.0\.0$/.test(h)) return true;
  if (/^10\./.test(h) || /^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  if (/^\[::1\]$/.test(h) || h === '::1') return true;
  return false;
}

export function validateUrl(raw: string): { url?: string; error?: string } {
  let u: URL;
  try { u = new URL(raw); } catch { return { error: 'URL 格式不正确，请检查后重试。' }; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { error: '仅支持 http / https 网页。' };
  if (isBlockedHost(u.hostname)) return { error: '该地址不允许访问。' };
  return { url: u.toString() };
}

function cleanText(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

export async function fetchWebPage(url: string): Promise<{ title: string; paragraphs: string[]; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AifanyiBot/1.0; +https://aifanyi.com)' },
      redirect: 'follow',
    });
    if (!res.ok) return { title: '', paragraphs: [], error: `网页返回 ${res.status}，可能无法访问。` };
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text/html') && !ct.includes('application/xhtml')) {
      return { title: '', paragraphs: [], error: '该地址不是网页（可能是文件或其他类型）。' };
    }
    // 流式读取，超限立即停止
    if (!res.body) return { title: '', paragraphs: [], error: '网页内容读取失败。' };
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE) {
        await reader.cancel();
        return { title: '', paragraphs: [], error: '网页内容过大（超过 4MB）。' };
      }
      chunks.push(value);
    }
    const buf = Buffer.concat(chunks);
    // 编码：优先 UTF-8，其次按 charset 猜测
    let html = new TextDecoder('utf-8').decode(buf);
    const charsetMatch = html.match(/charset=["']?([\w-]+)/i);
    if (charsetMatch && !/utf-?8/i.test(charsetMatch[1])) {
      try { html = new TextDecoder(charsetMatch[1]).decode(buf); } catch { /* 保持 utf-8 */ }
    }
    return extractContent(html);
  } catch (e: any) {
    return { title: '', paragraphs: [], error: e?.name === 'AbortError' ? '网页响应超时（15 秒）。' : '抓取网页失败，请确认网址可访问。' };
  } finally {
    clearTimeout(timer);
  }
}

function extractContent(html: string): { title: string; paragraphs: string[] } {
  // 标题
  let title = '';
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (t) title = cleanText(t[1].replace(/<[^>]+>/g, ''));
  title = title.slice(0, 120);

  // 去 script/style/nav/footer/header/iframe/svg
  let body = html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  // 提取正文块：h1-h6 / p / li / blockquote / td
  const blocks: string[] = [];
  const re = /<(h[1-6]|p|li|blockquote|td)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const text = cleanText(m[2].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/g, "'"));
    if (text.length >= 12) blocks.push(text); // 过滤短噪声（导航/按钮）
  }

  // 去重（保序）
  const seen = new Set<string>();
  const paragraphs: string[] = [];
  for (const b of blocks) {
    if (seen.has(b)) continue;
    seen.add(b);
    paragraphs.push(b);
    if (paragraphs.length >= MAX_PARAGRAPHS) break;
  }

  return { title, paragraphs };
}
