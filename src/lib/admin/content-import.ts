/**
 * 内容批量导入核心 v3（实现对抗审查员意见落地）
 * 相对 v2 修复：
 *  - P1-1 existingSlugs 全表构建（自动 slug 精确碰撞可检出，防 P2002 整批 500）
 *  - P1-2 MenuEntry slug 查重按 country 分组（跨国家同 slug 合法）；update 定位统一 (country, dish)
 *  - P1-3 RecipeEntry 专属更新分支（updateExisting 可达）
 *  - P2-7 dryRun 预览 imported/updated 与 meme-import 对齐
 *  - P2-8 lang 校验并入 it.language；启用 category 白名单；country 规范化
 *  - P2-2 Json 显式 null → Prisma.JsonNull（置空语义可用）
 *  - P3  servings 类型校验；conflict 用原始下标
 */
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import type { OpsIdentity } from './ops-auth';
import { logAdminAction } from './ops-auth';

export type ContentType = 'idiom' | 'slang' | 'untranslatable' | 'food' | 'expression' | 'scene' | 'menu' | 'recipe';

const TYPE_WHITELIST: ContentType[] = ['idiom', 'slang', 'untranslatable', 'food', 'expression', 'scene', 'menu', 'recipe'];
const KIND_WHITELIST = ['travel', 'life'];
const LANG_WHITELIST = ['zh-CN', 'zh', 'en', 'ja', 'ko', 'th', 'fr', 'it', 'de', 'es', 'ru'];
const CATEGORY_WHITELIST = ['main', 'soup', 'snack', 'dessert', 'drink', 'noodle', 'rice', 'other'];
const DIFFICULTY_WHITELIST = ['简单', '中等', '困难', 'easy', 'medium', 'hard'];

export interface ContentImportItem {
  type: ContentType;
  slug?: string;
  term?: string;
  lang?: string;
  language?: string; // scene/menu 兼容字段（与 lang 同义）
  meaning?: string;
  translation?: string;
  pinyin?: string;
  literal?: string;
  examples?: unknown[];
  usage?: string;
  note?: string;
  source?: string;
  culture?: string;
  misTranslated?: unknown[];
  multiLang?: unknown[]; // [{lang, text}]
  tags?: string[];
  country?: string;
  scene?: string;
  kind?: string;
  title?: string;
  intro?: string;
  phrases?: unknown[];
  tips?: unknown[];
  cautions?: unknown[];
  related?: unknown[];
  dish?: string;
  romanized?: string;
  zh?: string;
  en?: string;
  description?: string;
  category?: string;
  pairings?: unknown[];
  originalName?: string;
  zhName?: string;
  enName?: string;
  ingredients?: unknown[];
  steps?: unknown[];
  cookTime?: string;
  difficulty?: string;
  servings?: number;
  vocab?: unknown[];
  popularity?: number;
  status?: string;
}

export interface ContentConflict {
  index: number;
  key: string;
  reason: string;
}

export interface ContentImportResult {
  ok: boolean;
  batchId: string;
  action: string;
  imported: number;
  updated: number;
  skipped: number;
  skippedDetails?: { index: number; key: string; reason: string }[];
  conflicts: ContentConflict[];
  created: string[];
  repeated?: boolean;
}

export function slugNorm(slug: string): string {
  return slug.replace(/-/g, '').toLowerCase();
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function modelOf(type: ContentType): 'expressionEntry' | 'sceneEntry' | 'menuEntry' | 'recipeEntry' {
  if (type === 'scene') return 'sceneEntry';
  if (type === 'menu') return 'menuEntry';
  if (type === 'recipe') return 'recipeEntry';
  return 'expressionEntry';
}

function validateItem(it: ContentImportItem): string | null {
  if (!it || typeof it !== 'object') return 'invalid_row';
  const t = it.type;
  if (!t) return 'missing_type';
  if (!TYPE_WHITELIST.includes(t)) return 'unknown_type';
  if (t === 'scene') {
    if (!it.country || !it.language || !it.scene || !it.title || !it.intro || !Array.isArray(it.phrases)) return 'missing_fields';
    if (it.kind && !KIND_WHITELIST.includes(it.kind)) return 'invalid_kind';
  } else if (t === 'menu') {
    if (!it.country || !it.language || !it.dish || !it.zh) return 'missing_fields';
    if (it.category && !CATEGORY_WHITELIST.includes(it.category)) return 'invalid_category';
  } else if (t === 'recipe') {
    if (!it.dish || !it.zhName || !Array.isArray(it.ingredients) || !Array.isArray(it.steps)) return 'missing_fields';
    if (it.difficulty && !DIFFICULTY_WHITELIST.includes(it.difficulty)) return 'invalid_difficulty';
    if (it.category && !CATEGORY_WHITELIST.includes(it.category)) return 'invalid_category';
    if (it.servings !== undefined && typeof it.servings !== 'number') return 'invalid_servings';
  } else {
    if (!it.term || !it.meaning || !it.translation) return 'missing_fields';
  }
  const lang = it.lang || it.language;
  if (lang && !LANG_WHITELIST.includes(lang)) return 'invalid_lang';
  if (it.status && !['published', 'draft'].includes(it.status)) return 'invalid_status';
  // multiLang shape 校验：数组且每项 {lang, text}
  if (it.multiLang !== undefined) {
    if (!Array.isArray(it.multiLang)) return 'invalid_multilang';
    for (const m of it.multiLang) {
      const mm = m as Record<string, unknown>;
      if (!mm || typeof mm.lang !== 'string' || typeof mm.text !== 'string') return 'invalid_multilang';
    }
  }
  return null;
}

function buildData(it: ContentImportItem): any {
  const t = it.type;
  const base: any = {
    popularity: it.popularity ?? 0,
    status: it.status || 'published',
  };
  if (t === 'scene') {
    return {
      ...base,
      slug: it.slug || `${it.country}-${it.scene}`,
      country: it.country, lang: it.language, scene: it.scene,
      kind: it.kind || 'travel', title: it.title, intro: it.intro,
      phrases: (it.phrases as any) || [],
      tips: it.tips as any, cautions: it.cautions as any, related: it.related as any,
    };
  }
  if (t === 'menu') {
    return {
      ...base,
      slug: it.slug || slugify(it.zh || '') || slugify(it.dish || ''),
      country: it.country, lang: it.language, dish: it.dish,
      romanized: it.romanized || null, zh: it.zh, en: it.en || null,
      description: it.description || null, category: it.category || null,
      pairings: it.pairings as any, tags: it.tags || [],
    };
  }
  if (t === 'recipe') {
    return {
      ...base,
      slug: it.slug || slugify(it.zhName || '') || slugify(it.dish || ''),
      dish: it.dish, originalName: it.originalName || null, zhName: it.zhName, enName: it.enName || null,
      country: it.country || null, category: it.category || null,
      intro: it.intro || null, ingredients: it.ingredients as any, steps: it.steps as any,
      cookTime: it.cookTime || null, difficulty: it.difficulty || null, servings: it.servings ?? null,
      vocab: it.vocab as any, misTranslated: it.misTranslated as any, culture: it.culture || null,
    };
  }
  return {
    ...base,
    slug: it.slug || slugify(it.term || ''),
    term: it.term, type: t, lang: it.lang || 'zh-CN',
    meaning: it.meaning, translation: it.translation,
    pinyin: it.pinyin || null, literal: it.literal || null,
    examples: it.examples as any,
    usage: it.usage || null, note: it.note || null, source: it.source || null, culture: it.culture || null,
    misTranslated: it.misTranslated as any, multiLang: it.multiLang as any,
    tags: it.tags || [],
  };
}

/** update 的 data：Json 显式 null → Prisma.JsonNull；省略（undefined）保留旧值 */
function buildUpdateData(it: ContentImportItem): any {
  const data: any = buildData(it);
  delete data.slug;
  const jsonFields = ['tips', 'cautions', 'related', 'pairings', 'multiLang', 'misTranslated', 'vocab', 'examples'];
  for (const f of jsonFields) {
    if (data[f] === null) data[f] = Prisma.JsonNull;
    else if (data[f] === undefined) delete data[f];
  }
  // 标量省略（undefined）保留旧值
  const scalarFields = ['pinyin', 'literal', 'usage', 'note', 'source', 'culture', 'romanized', 'en', 'description', 'category', 'originalName', 'enName', 'country', 'intro', 'cookTime', 'difficulty', 'servings', 'term', 'meaning', 'translation', 'lang', 'zh', 'dish', 'title', 'intro'];
  for (const f of scalarFields) {
    if (data[f] === undefined) delete data[f];
  }
  return data;
}

export async function importContent(input: {
  batchId: string;
  items: ContentImportItem[];
  dryRun: boolean;
  updateExisting: boolean;
  identity: OpsIdentity;
  ip?: string | null;
}): Promise<ContentImportResult> {
  const { batchId, dryRun, updateExisting, identity } = input;
  const items = input.items;

  const mainType = items[0]?.type || 'mixed';
  const action = `content.import.${mainType}`;

  const prev = await prisma.adminLog.findFirst({
    where: { action, batchId },
    orderBy: { createdAt: 'desc' },
  });
  if (prev) {
    const r = (prev.result as ContentImportResult | null) ?? null;
    if (r) return { ...r, repeated: true };
    return { ok: true, batchId, action, imported: 0, updated: 0, skipped: 0, conflicts: [], created: [], repeated: true };
  }

  // ── 行级校验（保留原始下标）──
  const conflicts: ContentConflict[] = [];
  const valid: { item: ContentImportItem; origIdx: number }[] = [];
  items.forEach((it, idx) => {
    const err = validateItem(it);
    if (err) {
      conflicts.push({ index: idx, key: it?.slug || it?.term || '', reason: err });
      return;
    }
    valid.push({ item: it, origIdx: idx });
  });

  const byModel: Record<string, { item: ContentImportItem; origIdx: number }[]> = {};
  for (const v of valid) {
    const m = modelOf(v.item.type);
    (byModel[m] = byModel[m] || []).push(v);
  }

  // ── 查重数据构建 ──
  const existingTerms = new Set<string>(); // type:term
  const existingSlugs = new Map<string, Set<string>>(); // model -> 全表 slug（menu 按 country 另存）
  const existingMenuSlugs = new Map<string, Set<string>>(); // country -> slug set
  const existingSceneKeys = new Set<string>();
  const existingMenuDishes = new Set<string>(); // country:dish
  const normMap = new Map<string, Map<string, string>>();

  for (const [m, its] of Object.entries(byModel)) {
    // 全表 slug（P1-1 修复：existingSlugs 与 normMap 同源）
    const allSlugs = await (prisma as any)[m].findMany({ select: m === 'menuEntry' ? { slug: true, country: true } : { slug: true } });
    const slugSet = new Set<string>(allSlugs.map((e: any) => e.slug));
    existingSlugs.set(m, slugSet);
    const nm = new Map<string, string>();
    allSlugs.forEach((e: any) => {
      const n = slugNorm(e.slug);
      if (!nm.has(n)) nm.set(n, e.slug);
    });
    normMap.set(m, nm);
    // menu 按 country 分组（P1-2 修复：跨国家同 slug 合法）
    if (m === 'menuEntry') {
      for (const e of allSlugs) {
        const c = String(e.country || '');
        if (!existingMenuSlugs.has(c)) existingMenuSlugs.set(c, new Set());
        (existingMenuSlugs.get(c) as Set<string>).add(e.slug);
      }
    }

    if (m === 'expressionEntry') {
      const typeTerms = its.map((v) => ({ type: v.item.type, term: v.item.term || '' }));
      const exist = await (prisma as any).expressionEntry.findMany({
        where: { OR: typeTerms.map((t) => ({ type: t.type, term: t.term })) },
        select: { type: true, term: true },
      });
      exist.forEach((e: any) => existingTerms.add(e.type + ':' + e.term));
    }
    if (m === 'sceneEntry') {
      const keys = its.map((v) => `${v.item.country}:${v.item.kind || 'travel'}:${v.item.scene}`);
      const exist = await (prisma as any).sceneEntry.findMany({
        where: { OR: keys.map((k) => { const [country, kind, scene] = k.split(':'); return { country, kind, scene }; }) },
        select: { country: true, kind: true, scene: true },
      });
      exist.forEach((e: any) => existingSceneKeys.add(`${e.country}:${e.kind}:${e.scene}`));
    }
    if (m === 'menuEntry') {
      const keys = its.map((v) => `${v.item.country}:${v.item.dish}`);
      const exist = await (prisma as any).menuEntry.findMany({
        where: { OR: keys.map((k) => { const [country, dish] = k.split(':'); return { country, dish }; }) },
        select: { country: true, dish: true },
      });
      exist.forEach((e: any) => existingMenuDishes.add(`${e.country}:${e.dish}`));
    }
  }

  // ── 分派 ──
  const toCreate: { item: ContentImportItem; origIdx: number }[] = [];
  const toUpdate: { item: ContentImportItem; origIdx: number }[] = [];
  const skipped: { index: number; key: string; reason: string }[] = [];
  const created: string[] = [];
  const batchSeen = new Set<string>();
  const batchNormSeen = new Map<string, Map<string, string>>();
  const batchSceneSeen = new Set<string>();
  const batchMenuSeen = new Set<string>();

  const finalSlugOf = (it: ContentImportItem, m: string): string => {
    if (it.slug) return it.slug;
    if (m === 'expressionEntry') return slugify(it.term || '');
    if (m === 'sceneEntry') return `${it.country}-${it.scene}`;
    if (m === 'menuEntry') return slugify(it.zh || '') || slugify(it.dish || '');
    return slugify(it.zhName || '') || slugify(it.dish || '');
  };

  valid.forEach(({ item: it, origIdx }) => {
    const m = modelOf(it.type);
    const finalSlug = finalSlugOf(it, m);
    const key = m === 'expressionEntry' ? it.type + ':' + it.term : finalSlug;
    const batchKey = m + ':' + key;
    if (batchSeen.has(batchKey)) {
      conflicts.push({ index: origIdx, key, reason: 'duplicate_in_batch' });
      return;
    }
    batchSeen.add(batchKey);

    // 场景三元组
    if (m === 'sceneEntry') {
      const sk = `${it.country}:${it.kind || 'travel'}:${it.scene}`;
      if (existingSceneKeys.has(sk) || batchSceneSeen.has(sk)) {
        if (updateExisting && existingSceneKeys.has(sk)) { toUpdate.push({ item: it, origIdx }); return; }
        if (existingSceneKeys.has(sk)) { skipped.push({ index: origIdx, key, reason: 'scene_exists' }); return; }
        conflicts.push({ index: origIdx, key, reason: 'duplicate_in_batch' });
        return;
      }
      batchSceneSeen.add(sk);
    }
    // 菜单 country+dish
    if (m === 'menuEntry') {
      const dk = `${it.country}:${it.dish}`;
      if (existingMenuDishes.has(dk) || batchMenuSeen.has(dk)) {
        if (updateExisting && existingMenuDishes.has(dk)) { toUpdate.push({ item: it, origIdx }); return; }
        if (existingMenuDishes.has(dk)) { skipped.push({ index: origIdx, key, reason: 'dish_exists' }); return; }
        conflicts.push({ index: origIdx, key, reason: 'duplicate_in_batch' });
        return;
      }
      batchMenuSeen.add(dk);
    }
    // 词条 term（type 内）
    if (m === 'expressionEntry') {
      const tk = it.type + ':' + it.term;
      if (existingTerms.has(tk)) {
        if (updateExisting) { toUpdate.push({ item: it, origIdx }); return; }
        skipped.push({ index: origIdx, key, reason: 'term_exists' });
        return;
      }
    }
    // Recipe：slug 命中且 updateExisting → 更新（P1-3 修复）
    if (m === 'recipeEntry' && (existingSlugs.get(m) || new Set()).has(finalSlug)) {
      if (updateExisting) { toUpdate.push({ item: it, origIdx }); return; }
      conflicts.push({ index: origIdx, key, reason: 'slug_exists' });
      return;
    }
    // slug 精确检查（menu 按 country；P1-1/P1-2 修复）
    if (m === 'menuEntry') {
      const cSet = existingMenuSlugs.get(it.country || '') || new Set<string>();
      if (cSet.has(finalSlug)) {
        conflicts.push({ index: origIdx, key, reason: 'slug_exists' });
        return;
      }
    } else {
      if ((existingSlugs.get(m) || new Set()).has(finalSlug)) {
        conflicts.push({ index: origIdx, key, reason: 'slug_exists' });
        return;
      }
    }
    // norm 双风格
    const norm = slugNorm(finalSlug);
    const normConflict = (normMap.get(m) || new Map()).get(norm) || (batchNormSeen.get(m) || new Map()).get(norm);
    if (normConflict && normConflict !== finalSlug) {
      conflicts.push({ index: origIdx, key, reason: `slug_conflict(${normConflict})` });
      return;
    }
    if (!batchNormSeen.has(m)) batchNormSeen.set(m, new Map());
    (batchNormSeen.get(m) as Map<string, string>).set(norm, finalSlug);
    toCreate.push({ item: it, origIdx });
    created.push(finalSlug);
  });

  let imported = 0;
  let updated = 0;

  if (!dryRun) {
    await prisma.$transaction(async (tx: any) => {
      // 更新（P1-2B：menu 定位 country+dish；recipe 定位 slug）
      for (const { item: it } of toUpdate) {
        const m = modelOf(it.type);
        let found: any = null;
        if (m === 'expressionEntry') {
          found = await tx[m].findFirst({ where: { type: it.type, term: it.term } });
        } else if (m === 'menuEntry') {
          found = await tx[m].findFirst({ where: { country: it.country, dish: it.dish } });
        } else if (m === 'sceneEntry') {
          found = await tx[m].findFirst({ where: { country: it.country, kind: it.kind || 'travel', scene: it.scene } });
        } else {
          found = await tx[m].findFirst({ where: { slug: it.slug } });
        }
        if (!found) continue;
        // slug 变更冲突检测：显式新 slug 与现有其他行冲突
        if (it.slug && it.slug !== found.slug) {
          if (m === 'menuEntry') {
            const clash = await tx[m].findFirst({ where: { country: it.country, slug: it.slug, id: { not: found.id } } });
            if (clash) { conflicts.push({ index: -1, key: it.slug, reason: 'slug_exists_on_update' }); continue; }
          } else {
            const clash = await tx[m].findFirst({ where: { slug: it.slug, id: { not: found.id } } });
            if (clash) { conflicts.push({ index: -1, key: it.slug, reason: 'slug_exists_on_update' }); continue; }
          }
        }
        const data = buildUpdateData(it);
        if (it.slug && it.slug !== found.slug) data.slug = it.slug;
        await tx[m].update({ where: { id: found.id }, data });
        updated++;
      }
      for (const { item: it } of toCreate) {
        const m = modelOf(it.type);
        await tx[m].create({ data: buildData(it) });
        imported++;
      }
    });
  }

  const result: ContentImportResult = {
    ok: conflicts.length === 0,
    batchId,
    action,
    imported: dryRun ? toCreate.length : imported,
    updated: dryRun ? toUpdate.length : updated,
    skipped: skipped.length,
    skippedDetails: skipped,
    conflicts,
    created,
  };

  if (!dryRun) {
    try {
      await logAdminAction({
        identity,
        action,
        batchId,
        params: { detail: `imported=${imported} updated=${updated} skipped=${skipped.length} conflicts=${conflicts.length}` },
        result,
        ip: input.ip || null,
      });
    } catch {
      // 审计失败不阻断导入（并发同批时 AdminLog 唯一约束兜底）
    }
  }

  return result;
}
