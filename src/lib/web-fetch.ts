/**
 * 网页抓取 + 正文提取（零依赖）
 * SSRF 防护：仅 http/https + 拒绝内网地址；15s 超时；响应 ≤2MB
 */

const MAX_RESPONSE = 4 * 1024 * 1024;
const MAX_PARAGRAPHS = 50;

/** 私网/保留 IP 判定（含阿里云元数据 100.100.100.200、CGNAT、IPv6 私有段） */
function isPrivateIp(ip: string): boolean {
  const i = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (i === '::1' || i === '::' || i === '0.0.0.0') return true;
  // IPv4-mapped IPv6：[::ffff:127.0.0.1] → 剥前缀后按 IPv4 规则
  const m = i.match(/^::ffff:(.+)$/);
  const v4 = m ? m[1] : i;
  if (v4.includes('.')) {
    if (/^127\./.test(v4) || /^0\.0\.0\.0$/.test(v4)) return true;
    if (/^10\./.test(v4) || /^192\.168\./.test(v4)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(v4)) return true;
    if (/^169\.254\./.test(v4)) return true;
    // 阿里云元数据端点 + CGNAT 100.64/10
    if (/^100\.100\./.test(v4)) return true;
    if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(v4)) return true;
  }
  // IPv6 私有段
  if (/^fe80:/i.test(i) || /^fc00:/i.test(i) || /^fd/i.test(i)) return true;
  if (/^f[cd][0-9a-f]{2}:/i.test(i)) return true;
  return false;
}

function isBlockedHost(hostname: string): boolean {
  let h = hostname.toLowerCase().trim();
  // 去尾点（localhost. / 域名.）
  h = h.replace(/\.$/, '');
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  // 非常规 IP 字面量：全数字但非标准点分（十进制 2130706433 / 十六进制 0x7f000001 / 八进制 0177.0.0.1）
  if (/^[\d.]+$/.test(h) && !/^(\d{1,3}\.){3}\d{1,3}$/.test(h)) return true;
  if (/0x/i.test(h)) return true;
  if (/^[\d.]+$/.test(h)) {
    if (isPrivateIp(h)) return true;
  }
  // 域名形式：解析后核验（在 validateUrl 中做，这里仅兜底 IPv6 字面量）
  if (/^\[?[0-9a-f:]+\]?$/.test(h)) {
    if (isPrivateIp(h)) return true;
  }
  return false;
}

export async function validateUrl(raw: string): Promise<{ url?: string; error?: string }> {
  let u: URL;
  try { u = new URL(raw); } catch { return { error: 'URL 格式不正确，请检查后重试。' }; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { error: '仅支持 http / https 网页。' };
  if (isBlockedHost(u.hostname)) return { error: '该地址不允许访问。' };
  // DNS 解析核验：任一解析结果命中私网即拒（防域名解析到内网/元数据）
  try {
    const { lookup } = await import('dns/promises');
    const addrs = await lookup(u.hostname, { all: true });
    for (const a of addrs) {
      if (isPrivateIp(a.address)) return { error: '该地址不允许访问。' };
    }
  } catch (e: any) {
    if (e?.code === 'ENOTFOUND' || e?.code === 'EAI_AGAIN') {
      return { error: '域名无法解析，请确认网址正确。' };
    }
    // DNS 服务异常：保守拒绝（无法核验 = 不放行）
    return { error: '该地址暂时无法核验，请稍后再试。' };
  }
  return { url: u.toString() };
}

function cleanText(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

async function fetchOnce(url: string, controller: AbortController): Promise<Response> {
  return fetch(url, {
    signal: controller.signal,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AifanyiBot/1.0; +https://aifanyi.com)' },
    redirect: 'manual',
  });
}

export async function fetchWebPage(url: string): Promise<{ title: string; paragraphs: string[]; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    let current = url;
    let res = await fetchOnce(current, controller);
    // 手动逐跳（≤5 跳）：每跳对新 Location 重新执行私网核验
    for (let hop = 0; hop < 5 && res.status >= 300 && res.status < 400; hop++) {
      const loc = res.headers.get('location');
      if (!loc) break;
      const next = new URL(loc, current).toString();
      const v = await validateUrl(next);
      if (v.error) return { title: '', paragraphs: [], error: v.error };
      current = next;
      res = await fetchOnce(current, controller);
    }
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
