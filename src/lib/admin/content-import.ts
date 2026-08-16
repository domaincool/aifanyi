/**
 * 内容批量导入核心（内容矩阵 V1.0）：按 type 路由到 ExpressionEntry / SceneEntry / MenuEntry / RecipeEntry
 * 复用 meme-import 模式：batchId 幂等 / 行级校验 / 同表查重 / dryRun / 事务 upsert / AdminLog 审计
 *
 * 幂等策略：
 *  - batchId 幂等：AdminLog action='content.import' 同 batchId → 返回首次结果（不重跑）
 *  - 行级去重：词条类 term 唯一（已存在 → skipped 或 updateExisting 更新）；slug 精确唯一 + 双风格（去连字符）归一冲突
 *  - 批内去重：同批重复 type+slug 首条生效，其余进 conflicts
 */
import { prisma } from '@/lib/db';
import type { OpsIdentity } from './ops-auth';
import { logAdminAction } from './ops-auth';

export type ContentType = 'idiom' | 'slang' | 'untranslatable' | 'food' | 'expression' | 'scene' | 'menu' | 'recipe';

export interface ContentImportItem {
  type: ContentType;
  slug: string;
  // 词条类（idiom/slang/untranslatable/food/expression）
  term?: string;
  lang?: string;
  meaning?: string;
  translation?: string;
  pinyin?: string;
  literal?: string;
  example?: string;
  usage?: string;
  note?: string;
  source?: string;
  culture?: string;
  multiLang?: Record<string, string>;
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
  related?: unknown[];
  // 菜单类（menu）
  dish?: string;
  romaji?: string;
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
  vocab?: unknown[];
  misTranslated?: unknown[];
  // 通用
  popularity?: number;
}

export interface ContentConflict {
  index: number;
  key: string;
  reason: string;
}

export interface ContentImportResult {
  ok: boolean;
  batchId: string;
  imported: number;
  updated: number;
  skipped: number;
  skippedDetails?: { index: number; key: string; reason: string }[];
  conflicts: ContentConflict[];
  created: string[];
  repeated?: boolean;
}

/** slug 双风格归一（查重用）：去连字符 + 小写，yue-guang-zu 与 yueguangzu 视为同一 */
export function slugNorm(slug: string): string {
  return slug.replace(/-/g, '').toLowerCase();
}

/** 按 type 返回对应 Prisma 模型 key */
function modelOf(type: ContentType): 'expressionEntry' | 'sceneEntry' | 'menuEntry' | 'recipeEntry' {
  if (type === 'scene') return 'sceneEntry';
  if (type === 'menu') return 'menuEntry';
  if (type === 'recipe') return 'recipeEntry';
  return 'expressionEntry'; // idiom/slang/untranslatable/food/expression
}

/** 必填字段校验（按 type） */
function validateItem(it: ContentImportItem): string | null {
  if (!it || typeof it !== 'object') return 'invalid_row';
  if (!it.slug) return 'missing_slug';
  const t = it.type;
  if (!t) return 'missing_type';
  const validTypes: ContentType[] = ['idiom', 'slang', 'untranslatable', 'food', 'expression', 'scene', 'menu', 'recipe'];
  if (!validTypes.includes(t)) return 'unknown_type';
  if (t === 'scene') {
    if (!it.country || !it.language || !it.scene || !it.title || !it.intro) return 'missing_fields';
  } else if (t === 'menu') {
    if (!it.country || !it.language || !it.dish || !it.zh) return 'missing_fields';
  } else if (t === 'recipe') {
    if (!it.dish || !it.zhName || !Array.isArray(it.ingredients) || !Array.isArray(it.steps)) return 'missing_fields';
  } else {
    // 词条类
    if (!it.term || !it.meaning || !it.translation) return 'missing_fields';
  }
  return null;
}

/** 构建插入数据（按 type 映射到表字段） */
function buildData(it: ContentImportItem): any {
  const t = it.type;
  const base: any = { slug: it.slug, popularity: it.popularity ?? 0 };
  if (t === 'scene') {
    return {
      ...base,
      country: it.country, language: it.language, scene: it.scene,
      kind: it.kind || 'travel', title: it.title, intro: it.intro,
      phrases: (it.phrases as any) || [], tips: it.tips as any, related: it.related as any,
    };
  }
  if (t === 'menu') {
    return {
      ...base,
      country: it.country, language: it.language, dish: it.dish,
      romaji: it.romaji || null, zh: it.zh, en: it.en || null,
      description: it.description || null, category: it.category || null,
      pairings: it.pairings as any, tags: it.tags || [],
    };
  }
  if (t === 'recipe') {
    return {
      ...base,
      dish: it.dish, originalName: it.originalName || null, zhName: it.zhName, enName: it.enName || null,
      intro: it.intro || null, ingredients: it.ingredients as any, steps: it.steps as any,
      cookTime: it.cookTime || null, difficulty: it.difficulty || null,
      vocab: it.vocab as any, misTranslated: it.misTranslated as any, culture: it.culture || null,
    };
  }
  // 词条类
  return {
    ...base,
    term: it.term, type: t, lang: it.lang || 'zh-CN',
    meaning: it.meaning, translation: it.translation,
    pinyin: it.pinyin || null, literal: it.literal || null, example: it.example || null,
    usage: it.usage || null, note: it.note || null, source: it.source || null, culture: it.culture || null,
    multiLang: it.multiLang as any, tags: it.tags || [],
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

  // ── 幂等：同 batchId 已处理过 → 返回首次结果 ──
  const prev = await prisma.adminLog.findFirst({
    where: { action: 'content.import', batchId },
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

  // ── 查重：按表分组查询 ──
  const byModel: Record<string, ContentImportItem[]> = {};
  for (const it of valid) {
    const m = modelOf(it.type);
    (byModel[m] = byModel[m] || []).push(it);
  }

  const existingTerms = new Set<string>();
  const existingSlugs = new Map<string, Set<string>>(); // model -> slug set
  const normMap = new Map<string, Map<string, string>>(); // model -> norm -> original slug

  for (const [m, its] of Object.entries(byModel)) {
    const slugs = its.map((i) => i.slug);
    const terms = m === 'expressionEntry' ? its.map((i) => i.term || '') : [];
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
    if (terms.length > 0) {
      const byTerm = await (prisma as any)[m].findMany({ where: { term: { in: terms } }, select: { term: true } });
      byTerm.forEach((e: any) => existingTerms.add(e.term));
    }
  }

  // ── 分派：toCreate / toUpdate / skipped / conflicts ──
  const toCreate: ContentImportItem[] = [];
  const toUpdate: ContentImportItem[] = [];
  const skipped: { index: number; key: string; reason: string }[] = [];
  const created: string[] = [];
  const batchSeen = new Set<string>();
  const batchNormSeen = new Map<string, Map<string, string>>(); // model -> norm -> slug

  valid.forEach((it, idx) => {
    const m = modelOf(it.type);
    const key = m === 'expressionEntry' ? it.term! : it.slug;
    const batchKey = m + ':' + key;
    if (batchSeen.has(batchKey)) {
      conflicts.push({ index: idx, key, reason: 'duplicate_in_batch' });
      return;
    }
    batchSeen.add(batchKey);

    const termExists = m === 'expressionEntry' && existingTerms.has(it.term!);
    if (termExists) {
      if (updateExisting) { toUpdate.push(it); return; }
      skipped.push({ index: idx, key, reason: 'term_exists' });
      return;
    }
    if ((existingSlugs.get(m) || new Set()).has(it.slug)) {
      conflicts.push({ index: idx, key, reason: 'slug_exists' });
      return;
    }
    const norm = slugNorm(it.slug);
    const normConflict = (normMap.get(m) || new Map()).get(norm) || (batchNormSeen.get(m) || new Map()).get(norm);
    if (normConflict && normConflict !== it.slug) {
      conflicts.push({ index: idx, key, reason: `slug_conflict(${normConflict})` });
      return;
    }
    if (!batchNormSeen.has(m)) batchNormSeen.set(m, new Map());
    (batchNormSeen.get(m) as Map<string, string>).set(norm, it.slug);
    toCreate.push(it);
    created.push(it.slug);
  });

  let imported = 0;
  let updated = 0;

  if (!dryRun) {
    await prisma.$transaction(async (tx: any) => {
      // 更新 → 新建（按模型分组）
      const updateByModel: Record<string, ContentImportItem[]> = {};
      for (const it of toUpdate) {
        const m = modelOf(it.type);
        (updateByModel[m] = updateByModel[m] || []).push(it);
      }
      for (const [m, its] of Object.entries(updateByModel)) {
        for (const it of its) {
          const where = m === 'expressionEntry' ? { term: it.term } : { slug: it.slug };
          await tx[m].update({ where, data: buildData(it) });
          updated++;
        }
      }
      const createByModel: Record<string, ContentImportItem[]> = {};
      for (const it of toCreate) {
        const m = modelOf(it.type);
        (createByModel[m] = createByModel[m] || []).push(it);
      }
      for (const [m, its] of Object.entries(createByModel)) {
        for (const it of its) {
          await tx[m].create({ data: buildData(it) });
          imported++;
        }
      }
    });
  }

  const result: ContentImportResult = {
    ok: dryRun || conflicts.length === 0,
    batchId,
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
        action: 'content.import',
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
