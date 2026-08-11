/**
 * PDF Job 管理（Prisma 持久化，异步 Job 模式）
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { PdfDocument, PdfJobSummary, PdfJobStatus } from './types';
import { PDF_CONFIG } from './config';

export async function createPdfJob(input: {
  taskId: string;
  fileName: string;
  fileSize: number;
  doc: PdfDocument;
  clientKey: string;
  userId?: string | null;
  guestSessionId?: string | null;
}): Promise<{ taskId: string; status: PdfJobStatus }> {
  await prisma.pdfJob.create({
    data: {
      taskId: input.taskId,
      fileName: input.fileName,
      fileSize: input.fileSize,
      pageCount: input.doc.pageCount,
      sourceLang: input.doc.sourceLang,
      targetLang: input.doc.targetLang,
      status: 'queued',
      totalBlocks: input.doc.pages.reduce((s, p) => s + p.blocks.length, 0),
      limitations: input.doc.limitations,
      document: input.doc as unknown as object,
      clientKey: input.clientKey,
      userId: input.userId ?? null,
      guestSessionId: input.guestSessionId ?? null,
      expiresAt: new Date(Date.now() + 24 * 3600_000),
    },
  });
  return { taskId: input.taskId, status: 'queued' };
}

export async function updatePdfJob(
  taskId: string,
  patch: {
    status?: PdfJobStatus;
    progress?: number;
    currentPage?: number;
    translatedBlocks?: number;
    errorType?: string;
    errorMessage?: string;
    document?: PdfDocument;
    totalInputTokens?: number;
    totalOutputTokens?: number;
    totalCostUsd?: number;
    apiErrorCount?: number;
    durationMs?: number;
  }
): Promise<void> {
  const data: Record<string, unknown> = { ...patch };
  if (patch.status === 'completed' || patch.status === 'failed') {
    data.completedAt = new Date();
    if (patch.status === 'completed') data.progress = 100;
  }
  await prisma.pdfJob.update({ where: { taskId }, data });
}

export async function getPdfJob(taskId: string): Promise<PdfJobSummary | null> {
  const job = await prisma.pdfJob.findUnique({ where: { taskId } });
  if (!job) return null;
  const summary: PdfJobSummary = {
    taskId: job.taskId,
    status: job.status as PdfJobStatus,
    progress: job.progress,
    currentPage: job.currentPage,
    totalPages: job.pageCount,
    translatedBlocks: job.translatedBlocks,
    totalBlocks: job.totalBlocks,
    errorType: job.errorType || undefined,
    message: job.errorMessage || undefined,
  };
  if (job.status === 'completed' && job.document) {
    summary.result = buildResult(job.document as unknown as PdfDocument, job);
  }
  return summary;
}

function buildResult(doc: PdfDocument, job: any): PdfJobSummary['result'] {
  const translatedBlocks = doc.pages.reduce(
    (s, p) => s + p.blocks.filter((b) => b.translations && (b.translations as any).deepseek).length, 0
  );
  const translatableBlocks = doc.pages.reduce(
    (s, p) => s + p.blocks.filter((b) => b.type !== 'header' && b.type !== 'footer' && b.type !== 'image').length, 0
  );
  const failedBlocks = Math.max(0, translatableBlocks - translatedBlocks);
  return {
    documentId: doc.documentId,
    fileName: doc.fileName,
    pageCount: doc.pageCount,
    sourceLang: doc.sourceLang,
    targetLang: doc.targetLang,
    limitations: doc.limitations,
    pages: doc.pages,
    stats: {
      totalBlocks: job.totalBlocks,
      translatedBlocks,
      failedBlocks,
      totalInputTokens: job.totalInputTokens || 0,
      totalOutputTokens: job.totalOutputTokens || 0,
      totalCostUsd: job.totalCostUsd || 0,
      durationMs: job.durationMs || 0,
      apiErrorCount: job.apiErrorCount || 0,
    },
  };
}

export async function cleanupExpiredPdfJobs(): Promise<number> {
  const cutoff = new Date(Date.now() - PDF_CONFIG.taskTtlMs);
  const res = await prisma.pdfJob.updateMany({
    where: { createdAt: { lt: cutoff }, document: { not: Prisma.JsonNull } },
    data: { document: Prisma.JsonNull, errorMessage: '任务数据已按 24h 隐私策略清理' },
  });
  return res.count;
}