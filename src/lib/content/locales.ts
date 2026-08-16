/** 内容栏目通用工具：国家/语言显示名映射 */
export const COUNTRY_NAMES: Record<string, string> = {
  japan: '日本',
  china: '中国',
  korea: '韩国',
  thailand: '泰国',
  france: '法国',
  italy: '意大利',
  india: '印度',
  vietnam: '越南',
  spain: '西班牙',
  germany: '德国',
  usa: '美国',
  uk: '英国',
  mexico: '墨西哥',
  turkey: '土耳其',
  morocco: '摩洛哥',
};

export const LANG_NAMES: Record<string, string> = {
  'zh-CN': '中文',
  zh: '中文',
  en: 'English',
  ja: '日本語',
  ko: '한국어',
  th: 'ไทย',
  fr: 'Français',
  it: 'Italiano',
  de: 'Deutsch',
  es: 'Español',
  ru: 'Русский',
  hi: 'हिन्दी',
  vi: 'Tiếng Việt',
  ar: 'العربية',
  pt: 'Português',
  tr: 'Türkçe',
  id: 'Bahasa Indonesia',
};

export function countryName(c: string | null | undefined): string {
  if (!c) return '未知地区';
  return COUNTRY_NAMES[c] || c;
}

export function langName(l: string | null | undefined): string {
  if (!l) return '';
  return LANG_NAMES[l] || l;
}
