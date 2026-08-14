/**
 * 词条批量导入核心（Phase B）：校验 / 双风格查重 / 批内去重 / batchId 幂等 / 事务 upsert
 *
 * 幂等策略：
 *  - batchId 幂等：AdminLog 中 action='memes.import' 且 batchId 相同 → 直接返回首次结果（不重跑）
 *  - 行级去重：term 唯一（已存在 → skipped 或 updateExisting 更新）；slug 精确唯一 + 双风格（去连字符）归一冲突
 *  - 批内去重：同批重复 term 首条生效，其余进 conflicts
 *  - AdminLog 唯一约束 (@@unique[action, batchId]) 兜底并发双写
 */
import { prisma } from '@/lib/db';
import type { OpsIdentity } from './ops-auth';
import { logAdminAction } from './ops-auth';

export interface MemeImportItem {
  term: string;
  slug: string;
  meaning: string;
  translation: string;
  examples?: { zh: string; en: string }[];
  tags?: string[];
  popularity?: number;
}

export interface MemeConflict {
  index: number;
  term: string;
  reason: string;
}

export interface MemeImportResult {
  ok: boolean;
  batchId: string;
  imported: number;
  updated: number;
  skipped: number;
  skippedDetails?: { index: number; term: string; reason: string }[];
  conflicts: MemeConflict[];
  created: string[];
  repeated?: boolean;
}

/** slug 双风格归一（查重用）：去连字符 + 小写，yue-guang-zu 与 yueguangzu 视为同一 */
export function slugNorm(slug: string): string {
  return slug.replace(/-/g, '').toLowerCase();
}

export async function importMemes(input: {
  batchId: string;
  items: MemeImportItem[];
  dryRun: boolean;
  updateExisting: boolean;
  identity: OpsIdentity;
  ip?: string | null;
}): Promise<MemeImportResult> {
  const { batchId, dryRun, updateExisting, identity } = input;
  const items = input.items;

  // ── 幂等：同 batchId 已处理过 → 返回首次结果 ──
  const prev = await prisma.adminLog.findFirst({
    where: { action: 'memes.import', batchId },
    orderBy: { createdAt: 'desc' },
  });
  if (prev) {
    const r = (prev.result as MemeImportResult | null) ?? null;
    if (r) return { ...r, repeated: true };
  }

  // ── 行级校验（必填字段）──
  const conflicts: MemeConflict[] = [];
  const valid: MemeImportItem[] = [];
  items.forEach((it, idx) => {
    if (!it || typeof it !== 'object') {
      conflicts.push({ index: idx, term: '', reason: 'invalid_row' });
      return;
    }
    if (!it.term || !it.slug || !it.meaning || !it.translation) {
      conflicts.push({ index: idx, term: it.term || '', reason: 'missing_fields' });
      return;
    }
    valid.push(it);
  });

  // ── 查重（DB 全量 slug 双风格索引）──
  const terms = valid.map((v) => v.term);
  const slugSet = new Set<string>();
  const termSet = new Set<string>();
  const slugNormMap = new Map<string, string>(); // norm -> original slug
  if (terms.length > 0) {
    const [existByTerm, existBySlug, allSlugs] = await Promise.all([
      prisma.memeEntry.findMany({ where: { term: { in: terms } }, select: { term: true } }),
      prisma.memeEntry.findMany({ where: { slug: { in: valid.map((v) => v.slug) } }, select: { slug: true } }),
      prisma.memeEntry.findMany({ select: { slug: true } }),
    ]);
    existByTerm.forEach((e) => termSet.add(e.term));
    existBySlug.forEach((e) => slugSet.add(e.slug));
    allSlugs.forEach((e) => {
      const n = slugNorm(e.slug);
      if (!slugNormMap.has(n)) slugNormMap.set(n, e.slug);
    });
  }

  const toCreate: MemeImportItem[] = [];
  const toUpdate: MemeImportItem[] = [];
  const skipped: { index: number; term: string; reason: string }[] = [];
  const created: string[] = [];
  const seenInBatch = new Set<string>();
  const batchNormSeen = new Map<string, string>(); // norm -> slug（本批已接受，防批内归一冲突）

  valid.forEach((it, idx) => {
    if (seenInBatch.has(it.term)) {
      conflicts.push({ index: idx, term: it.term, reason: 'duplicate_in_batch' });
      return;
    }
    seenInBatch.add(it.term);

    if (termSet.has(it.term)) {
      if (updateExisting) {
        toUpdate.push(it);
        return;
      }
      skipped.push({ index: idx, term: it.term, reason: 'term_exists' });
      return;
    }
    if (slugSet.has(it.slug)) {
      conflicts.push({ index: idx, term: it.term, reason: 'slug_exists' });
      return;
    }
    const norm = slugNorm(it.slug);
    const normConflict = slugNormMap.get(norm) || batchNormSeen.get(norm);
    if (normConflict && normConflict !== it.slug) {
      conflicts.push({ index: idx, term: it.term, reason: `slug_conflict(${normConflict})` });
      return;
    }
    batchNormSeen.set(norm, it.slug);
    toCreate.push(it);
    created.push(it.slug);
  });

  let imported = 0;
  let updated = 0;

  if (!dryRun) {
    // ── 事务：更新 → 新建 ──
    await prisma.$transaction(async (tx) => {
      for (const it of toUpdate) {
        const data: Record<string, unknown> = {
          slug: it.slug,
          meaning: it.meaning,
          translation: it.translation,
          examples: (it.examples ?? []) as unknown as object,
          tags: it.tags ?? [],
          popularity: it.popularity ?? 0,
        };
        const normDup = await tx.memeEntry.findFirst({ where: { slug: it.slug, NOT: { term: it.term } }, select: { id: true } });
        if (normDup) {
          conflicts.push({ index: idxOf(items, it), term: it.term, reason: 'slug_exists_on_update' });
          continue;
        }
        await tx.memeEntry.update({ where: { term: it.term }, data });
        updated++;
      }
      if (toCreate.length > 0) {
        await tx.memeEntry.createMany({
          data: toCreate.map((it) => ({
            term: it.term,
            slug: it.slug,
            meaning: it.meaning,
            translation: it.translation,
            examples: (it.examples ?? []) as unknown as object,
            tags: it.tags ?? [],
            popularity: it.popularity ?? 0,
            status: 'published',
          })),
        });
        imported = toCreate.length;
      }
    });

    // ── 审计（AdminLog 唯一约束 [action,batchId] 兜底并发）──
    await logAdminAction({
      identity,
      action: 'memes.import',
      batchId,
      params: { itemCount: items.length, dryRun, updateExisting },
      result: { imported, updated, skipped: skipped.length, conflicts },
      ip: input.ip,
    });
  } else {
    imported = toCreate.length; // dryRun 预览：可导入数量
  }

  return { ok: true, batchId, imported, updated, skipped: skipped.length, skippedDetails: skipped, conflicts, created };
}

function idxOf(items: MemeImportItem[], it: MemeImportItem): number {
  return items.findIndex((x) => x === it);
}
