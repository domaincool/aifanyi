import { prisma } from '@/lib/db';

/** 游客→登录迁移：把 guestSessionId 下的 PdfJob 转给 userId */
export async function migrateGuestTasks(guestSessionId: string, userId: string): Promise<number> {
  const result = await prisma.pdfJob.updateMany({
    where: { guestSessionId, userId: null },
    data: { userId },
  });
  return result.count;
}