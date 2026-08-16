/**
 * 内容批量导入核心（内容矩阵 V1.0 v2，采纳内容模型审查员意见）：
 * 按 type 路由到 ExpressionEntry / SceneEntry / MenuEntry / RecipeEntry
 *
 * 修复项（审查意见）：
 *  - AdminLog action 按类型区分（content.import.{type}），避免跨栏目 batchId 撞唯一约束
 *  - update 一律 findFirst 定位 → update by id（term 非全局唯一 / menu slug 复合唯一）
 *  - nullable Json 置空用 Prisma.JsonNull（undefined 不清空）
 *  - SceneEntry slug 自动生成（country-scene），查重按 (country, kind, scene) 三元组
 *  - 枚举白名单：type/lang/kind/category/difficulty（零新依赖，手写校验）
 *  - status 透传（运营草稿后审再发）
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
  // 词条类（idiom/slang/untranslatable/food/expression）
  term?: string;
  lang?: string;
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
  multiLang?: unknown[];
  tags?: string[];
  // 场景类（scene）
  country?: string;
  language?: string;
  scene?: string;
  kind?: string;
  title?: string;
  intro?: string;
  phrases?: unknown[];
  tips?: unknown[];
  cautions?: unknown[];
  related?: unknown[];
  // 菜单类（menu）
  dish?: string;
  romanized?: string;
  zh?: string;
  en?: string;
  description?: string;
  category?: string;
  pairings?: unknown[];
  // 菜谱类（recipe）
  originalName?: string;
  zhName?: string;
  enName?: string;
  ingredients?: unknown[];
  steps?: unknown[];
  cookTime?: string;
  difficulty?: string;
  servings?: number;
  vocab?: unknown[];
  // 通用
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

/** slug 双风格归一（查重用）：去连字符 + 小写 */
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

/** 按 type 返回对应 Prisma 模型 key */
function modelOf(type: ContentType): 'expressionEntry' | 'sceneEntry' | 'menuEntry' | 'recipeEntry' {
  if (type === 'scene') return 'sceneEntry';
  if (type === 'menu') return 'menuEntry';
  if (type === 'recipe') return 'recipeEntry';
  return 'expressionEntry';
}

/** 必填字段校验（按 type）+ 白名单 */
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
  } else if (t === 'recipe') {
    if (!it.dish || !it.zhName || !Array.isArray(it.ingredients) || !Array.isArray(it.steps)) return 'missing_fields';
    if (it.difficulty && !DIFFICULTY_WHITELIST.includes(it.difficulty)) return 'invalid_difficulty';
  } else {
    if (!it.term || !it.meaning || !it.translation) return 'missing_fields';
  }
  if (it.lang && !LANG_WHITELIST.includes(it.lang)) return 'invalid_lang';
  if (it.status && !['published', 'draft'].includes(it.status)) return 'invalid_status';
  return null;
}

/** 构建插入数据（按 type 映射到表字段） */
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
      slug: it.slug || slugify(it.zh || "") || slugify(it.dish || ""),
      country: it.country, lang: it.language, dish: it.dish,
      romanized: it.romanized || null, zh: it.zh, en: it.en || null,
      description: it.description || null, category: it.category || null,
      pairings: it.pairings as any, tags: it.tags || [],
    };
  }
  if (t === 'recipe') {
    return {
      ...base,
      slug: it.slug || slugify(it.zhName || "") || slugify(it.dish || ""),
      dish: it.dish, originalName: it.originalName || null, zhName: it.zhName, enName: it.enName || null,
      country: it.country || null, category: it.category || null,
      intro: it.intro || null, ingredients: it.ingredients as any, steps: it.steps as any,
      cookTime: it.cookTime || null, difficulty: it.difficulty || null, servings: it.servings ?? null,
      vocab: it.vocab as any, misTranslated: it.misTranslated as any, culture: it.culture || null,
    };
  }
  // 词条类
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

  // 按批首 type 生成幂等 action（跨栏目同 batchId 不撞唯一约束）
  const mainType = items[0]?.type || 'mixed';
  const action = `content.import.${mainType}`;

  // ── 幂等：同 batchId + action 已处理过 → 返回首次结果 ──
  const prev = await prisma.adminLog.findFirst({
    where: { action, batchId },
    orderBy: { createdAt: 'desc' },
  });
  if (prev) {
    const r = (prev.result as ContentImportResult | null) ?? null;
    if (r) return { ...r, repeated: true };
  }

  // ── 行级校验 ──
  const conflicts: ContentConflict[] = [];
  const valid: ContentImportItem[] = [];
  items.forEach((it, idx) => {
    const err = validateItem(it);
    if (err) {
      conflicts.push({ index: idx, key: it?.slug || it?.term || '', reason: err });
      return;
    }
    valid.push(it);
  });

  // ── 查重：按表分组 ──
  const byModel: Record<string, ContentImportItem[]> = {};
  for (const it of valid) {
    const m = modelOf(it.type);
    (byModel[m] = byModel[m] || []).push(it);
  }

  const existingTerms = new Set<string>(); // type:term
  const existingSlugs = new Map<string, Set<string>>(); // model -> slug set
  const existingSceneKeys = new Set<string>(); // country:kind:scene
  const existingMenuDishes = new Set<string>(); // country:dish
  const normMap = new Map<string, Map<string, string>>(); // model -> norm -> original slug

  for (const [m, its] of Object.entries(byModel)) {
    const slugs = its.map((i) => i.slug || '');
    const [bySlug, allSlugs] = await Promise.all([
      (prisma as any)[m].findMany({ where: { slug: { in: slugs } }, select: { slug: true } }),
      (prisma as any)[m].findMany({ select: { slug: true } }),
    ]);
    existingSlugs.set(m, new Set(bySlug.map((e: any) => e.slug)));
    const nm = new Map<string, string>();
    allSlugs.forEach((e: any) => {
      const n = slugNorm(e.slug);
      if (!nm.has(n)) nm.set(n, e.slug);
    });
    normMap.set(m, nm);

    if (m === 'expressionEntry') {
      const typeTerms = its.map((i) => ({ type: i.type, term: i.term || '' }));
      const exist = await (prisma as any).expressionEntry.findMany({
        where: { OR: typeTerms.map((t) => ({ type: t.type, term: t.term })) },
        select: { type: true, term: true },
      });
      exist.forEach((e: any) => existingTerms.add(e.type + ':' + e.term));
    }
    if (m === 'sceneEntry') {
      const keys = its.map((i) => `${i.country}:${i.kind || 'travel'}:${i.scene}`);
      const exist = await (prisma as any).sceneEntry.findMany({
        where: { OR: keys.map((k) => { const [country, kind, scene] = k.split(':'); return { country, kind, scene }; }) },
        select: { country: true, kind: true, scene: true },
      });
      exist.forEach((e: any) => existingSceneKeys.add(`${e.country}:${e.kind}:${e.scene}`));
    }
    if (m === 'menuEntry') {
      const keys = its.map((i) => `${i.country}:${i.dish}`);
      const exist = await (prisma as any).menuEntry.findMany({
        where: { OR: keys.map((k) => { const [country, dish] = k.split(':'); return { country, dish }; }) },
        select: { country: true, dish: true },
      });
      exist.forEach((e: any) => existingMenuDishes.add(`${e.country}:${e.dish}`));
    }
  }

  // ── 分派 ──
  const toCreate: ContentImportItem[] = [];
  const toUpdate: ContentImportItem[] = [];
  const skipped: { index: number; key: string; reason: string }[] = [];
  const created: string[] = [];
  const batchSeen = new Set<string>();
  const batchNormSeen = new Map<string, Map<string, string>>();
  const batchSceneSeen = new Set<string>();
  const batchMenuSeen = new Set<string>();

  valid.forEach((it, idx) => {
    const m = modelOf(it.type);
    const finalSlug = it.slug || (m === 'expressionEntry' ? slugify(it.term || '') : m === 'sceneEntry' ? `${it.country}-${it.scene}` : m === 'menuEntry' ? slugify(it.zh || it.dish || '') : slugify(it.zhName || it.dish || ''));
    const key = m === 'expressionEntry' ? it.type + ':' + it.term : finalSlug;
    const batchKey = m + ':' + key;
    if (batchSeen.has(batchKey)) {
      conflicts.push({ index: idx, key, reason: 'duplicate_in_batch' });
      return;
    }
    batchSeen.add(batchKey);

    // 场景三元组查重
    if (m === 'sceneEntry') {
      const sk = `${it.country}:${it.kind || 'travel'}:${it.scene}`;
      if (existingSceneKeys.has(sk) || batchSceneSeen.has(sk)) {
        if (updateExisting && existingSceneKeys.has(sk)) { toUpdate.push(it); return; }
        if (existingSceneKeys.has(sk)) { skipped.push({ index: idx, key, reason: 'scene_exists' }); return; }
        conflicts.push({ index: idx, key, reason: 'duplicate_in_batch' });
        return;
      }
      batchSceneSeen.add(sk);
    }
    // 菜单 country+dish 查重
    if (m === 'menuEntry') {
      const dk = `${it.country}:${it.dish}`;
      if (existingMenuDishes.has(dk) || batchMenuSeen.has(dk)) {
        if (updateExisting && existingMenuDishes.has(dk)) { toUpdate.push(it); return; }
        if (existingMenuDishes.has(dk)) { skipped.push({ index: idx, key, reason: 'dish_exists' }); return; }
        conflicts.push({ index: idx, key, reason: 'duplicate_in_batch' });
        return;
      }
      batchMenuSeen.add(dk);
    }
    // term 查重（词条类）
    if (m === 'expressionEntry') {
      const tk = it.type + ':' + it.term;
      if (existingTerms.has(tk)) {
        if (updateExisting) { toUpdate.push(it); return; }
        skipped.push({ index: idx, key, reason: 'term_exists' });
        return;
      }
    }
    // slug 查重（双风格）
    if ((existingSlugs.get(m) || new Set()).has(finalSlug)) {
      conflicts.push({ index: idx, key, reason: 'slug_exists' });
      return;
    }
    const norm = slugNorm(finalSlug);
    const normConflict = (normMap.get(m) || new Map()).get(norm) || (batchNormSeen.get(m) || new Map()).get(norm);
    if (normConflict && normConflict !== finalSlug) {
      conflicts.push({ index: idx, key, reason: `slug_conflict(${normConflict})` });
      return;
    }
    if (!batchNormSeen.has(m)) batchNormSeen.set(m, new Map());
    (batchNormSeen.get(m) as Map<string, string>).set(norm, finalSlug);
    toCreate.push(it);
    created.push(finalSlug);
  });

  let imported = 0;
  let updated = 0;

  if (!dryRun) {
    await prisma.$transaction(async (tx: any) => {
      const JN = Prisma.JsonNull;
      // 更新：findFirst 定位 → update by id
      for (const it of toUpdate) {
        const m = modelOf(it.type);
        const data: any = buildData(it);
        // nullable Json 置空语义：undefined 不清空
        for (const f of ['tips', 'cautions', 'related', 'pairings', 'multiLang', 'misTranslated', 'vocab', 'examples']) {
          if (data[f] === undefined) delete data[f];
        }
        let found: any = null;
        if (m === 'expressionEntry') {
          found = await tx[m].findFirst({ where: { type: it.type, term: it.term } });
        } else if (m === 'menuEntry') {
          found = await tx[m].findFirst({ where: { country: it.country, slug: it.slug || slugify(it.zh || it.dish || '') } });
        } else if (m === 'sceneEntry') {
          found = await tx[m].findFirst({ where: { country: it.country, kind: it.kind || 'travel', scene: it.scene } });
        } else {
          found = await tx[m].findFirst({ where: { slug: it.slug } });
        }
        if (!found) continue;
        delete data.slug;
        await tx[m].update({ where: { id: found.id }, data });
        updated++;
      }
      // 新建
      for (const it of toCreate) {
        const m = modelOf(it.type);
        await tx[m].create({ data: buildData(it) });
        imported++;
      }
    });
  }

  const result: ContentImportResult = {
    ok: dryRun || conflicts.length === 0,
    batchId,
    action,
    imported,
    updated,
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
      // 审计失败不阻断导入
    }
  }

  return result;
}
