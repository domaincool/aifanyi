/**
 * SEO 公共函数（流量增长 V1.0 Week1 D1-D2）
 * 设计依据：蓝图 P0 修复项——全站 canonical 缺失 + OG/Twitter 全站共用一套
 *
 * 用法：
 *   export const metadata: Metadata = buildMetadata({ path: '/meme', title: '...', description: '...' });
 *   // 或动态页面 generateMetadata 内 return buildMetadata({...})
 *   // 参数化列表页（带 q/tag/page）用 buildListNoindex 包一层：noindex,follow + canonical 指稳定路径
 */
import type { Metadata } from 'next';

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://aifanyi.com';

/** 稳定 canonical（去掉 query/hash/trailing 差异；path 必须以 / 开头） */
export function canonicalUrl(path: string): string {
  let p = path || '/';
  if (!p.startsWith('/')) p = '/' + p;
  // 去重复斜杠 + 去尾斜杠（首页除外）
  p = p.replace(/\/+/g, '/');
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return SITE_URL + p;
}

/** OG 分型：home / tool / content（词条）/ list（栏目列表），图片按类型选 fallback */
export type OgType = 'home' | 'tool' | 'content' | 'list';

function ogImageFor(type: OgType): { url: string; width: number; height: number; alt: string } {
  // og-image.png 全站通用（1200x630，已存在）；词条类用同图但 title 定制
  return { url: SITE_URL + '/og-image.png', width: 1200, height: 630, alt: '爱翻译 aifanyi.com' };
}

/**
 * 统一 Metadata 构造器（canonical + OG + Twitter 一步到位）
 * - path: 页面路径（'/meme/xswl'），canonical 由它生成
 * - noindex: true 时输出 robots noindex,follow（参数化列表页/搜索页专用，蓝图 P2 同款规则）
 */
export function buildMetadata(opts: {
  path: string;
  title: string;
  description: string;
  keywords?: string[];
  ogType?: OgType;
  ogTitle?: string;
  noindex?: boolean;
  changeFrequency?: 'daily' | 'weekly' | 'monthly';
  priority?: number;
}): Metadata {
  const url = canonicalUrl(opts.path);
  const ogTitle = opts.ogTitle || opts.title;
  const og = ogImageFor(opts.ogType || 'list');
  return {
    ...(opts.noindex ? { robots: { index: false, follow: true } } : {}),
    alternates: { canonical: url },
    openGraph: {
      title: ogTitle,
      description: opts.description,
      url,
      siteName: '爱翻译 aifanyi.com',
      locale: 'zh_CN',
      type: 'website',
      images: [og],
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: opts.description,
      images: [og.url],
    },
    ...(opts.keywords && opts.keywords.length ? { keywords: opts.keywords } : {}),
  };
}

/**
 * 参数化列表页专用：noindex,follow + canonical 指稳定基础路径
 * （蓝图 P0：/meme ?q=/?tag=/?page= 参数页裸奔 → 与 5.6 ?q= noindex 同一治理规则）
 * 基础列表页（无参数）仍可索引，canonical 指自身。
 */
export function buildListMetadata(opts: {
  basePath: string;            // 例 '/meme'
  params?: Record<string, string | undefined>; // 有值才视为参数化页
  title: string;
  description: string;
  keywords?: string[];
}): Metadata {
  const hasParams = Object.values(opts.params || {}).some((v) => v !== undefined && v !== '' && v !== null && v !== '1');
  if (!hasParams) {
    return buildMetadata({ path: opts.basePath, title: opts.title, description: opts.description, keywords: opts.keywords, ogType: 'list' });
  }
  // 参数化：noindex + canonical 仍指基础路径（收权）
  return buildMetadata({ path: opts.basePath, title: opts.title, description: opts.description, keywords: opts.keywords, ogType: 'list', noindex: true });
}
