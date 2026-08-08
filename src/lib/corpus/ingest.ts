import { prisma } from '@/lib/db';

/**
 * 数据飞轮 · 采集管线
 * 所有用户行为（投票、纠错、工作台编辑）最终都汇入语料库，
 * 入库前做质量分与去重，低分数据隔离。
 */

interface CorpusInput {
  sourceText: string;
  targetText: string;
  sourceLang: string;
  targetLang: string;
  scenario: 'blindtest' | 'workbench' | 'correction' | 'community';
  quality?: number; // 1-5，默认 3
}

/** 写入语料库（去重：同 source+target 且同场景不重复入库） */
export async function ingestCorpus(input: CorpusInput): Promise<void> {
  const quality = Math.min(5, Math.max(1, input.quality ?? 3));
  if (quality < 2) return; // 低分数据直接隔离，不入库

  const exists = await prisma.corpusEntry.findFirst({
    where: {
      sourceText: input.sourceText,
      targetText: input.targetText,
      scenario: input.scenario,
    },
  });
  if (exists) return;

  await prisma.corpusEntry.create({
    data: {
      sourceText: input.sourceText,
      targetText: input.targetText,
      sourceLang: input.sourceLang,
      targetLang: input.targetLang,
      scenario: input.scenario,
      quality,
    },
  });
}

/** 记录纠错对（pending 状态，人工/规则审核后 accepted 才进语料库） */
export async function ingestCorrection(input: {
  sourceText: string;
  badText: string;
  goodText: string;
  sourceLang?: string;
  targetLang?: string;
  userId?: string;
}): Promise<void> {
  if (!input.sourceText || !input.badText || !input.goodText) return;
  await prisma.correction.create({
    data: {
      sourceText: input.sourceText,
      badText: input.badText,
      goodText: input.goodText,
      sourceLang: input.sourceLang ?? 'zh',
      targetLang: input.targetLang ?? 'en',
      userId: input.userId,
    },
  });
}

/** 纠错被采纳 → 转入正式语料库 */
export async function acceptCorrection(correctionId: string): Promise<void> {
  const c = await prisma.correction.findUnique({ where: { id: correctionId } });
  if (!c) return;
  await prisma.$transaction([
    prisma.correction.update({ where: { id: correctionId }, data: { status: 'accepted' } }),
    prisma.corpusEntry.create({
      data: {
        sourceText: c.sourceText,
        targetText: c.goodText,
        sourceLang: c.sourceLang,
        targetLang: c.targetLang,
        scenario: 'correction',
        quality: 5,
      },
    }),
  ]);
}
