/**
 * LanguageRegistry（Phase 0）
 * 统一现有语言配置：2-letter ISO 639-1 代码 → 中文名 / 本族语名 / BCP47。
 * 仅做语言配置统一抽象，不扩展语言管理后台 / 术语库 / 企业语言包。
 */

export interface Language {
  code: string;       // 系统内部 2-letter ISO 639-1 代码
  bcp47: string;      // BCP47 语言标签（html lang / 语音合成 / 翻译 API）
  nameZh: string;     // 中文名
  nameNative: string; // 本族语名
}

export const LANGUAGES: Language[] = [
  { code: 'zh', bcp47: 'zh-CN', nameZh: '中文', nameNative: '中文' },
  { code: 'en', bcp47: 'en-US', nameZh: '英语', nameNative: 'English' },
  { code: 'ja', bcp47: 'ja-JP', nameZh: '日语', nameNative: '日本語' },
  { code: 'ko', bcp47: 'ko-KR', nameZh: '韩语', nameNative: '한국어' },
  { code: 'fr', bcp47: 'fr-FR', nameZh: '法语', nameNative: 'Français' },
  { code: 'de', bcp47: 'de-DE', nameZh: '德语', nameNative: 'Deutsch' },
  { code: 'es', bcp47: 'es-ES', nameZh: '西班牙语', nameNative: 'Español' },
  { code: 'ru', bcp47: 'ru-RU', nameZh: '俄语', nameNative: 'Русский' },
  { code: 'pt', bcp47: 'pt-BR', nameZh: '葡萄牙语', nameNative: 'Português' },
  { code: 'ar', bcp47: 'ar-SA', nameZh: '阿拉伯语', nameNative: 'العربية' },
];

export const LANGUAGE_BY_CODE: Record<string, Language> = Object.fromEntries(
  LANGUAGES.map((l) => [l.code, l]),
);

export const SUPPORTED_CODES: string[] = LANGUAGES.map((l) => l.code);

/** 兼容现有 LANGS 下拉形状：{ code, label }，label 用本族语名 */
export const LANG_OPTIONS: { code: string; label: string }[] = LANGUAGES.map((l) => ({
  code: l.code,
  label: l.nameNative,
}));

export function getLanguage(code: string): Language | undefined {
  return LANGUAGE_BY_CODE[code];
}

export function isSupportedLanguage(code: string): boolean {
  return code in LANGUAGE_BY_CODE;
}

/** 2-letter code → BCP47（未知代码原样返回） */
export function toBcp47(code: string): string {
  return LANGUAGE_BY_CODE[code]?.bcp47 ?? code;
}

/** 2-letter code → 中文名（未知代码原样返回） */
export function toNameZh(code: string): string {
  return LANGUAGE_BY_CODE[code]?.nameZh ?? code;
}
