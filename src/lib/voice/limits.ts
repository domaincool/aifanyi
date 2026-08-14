/**
 * 语音功能服务端限制（权威，前端只展示）
 * 每用户每分钟调用次数限制（DB 持久化：VoiceRateUsage 表按分钟计数，重启不绕过）
 */
import { prisma } from '@/lib/db';

export async function checkRateLimit(userId: string, perMinute = 5): Promise<boolean> {
  const now = new Date(Date.now() + 8 * 3600_000);
  const minuteKey = now.toISOString().slice(0, 13).replace(/[-:T]/g, '').slice(0, 12); // YYYYMMDDHHMM
  const row = await prisma.voiceRateUsage.upsert({
    where: { userId_minuteKey: { userId, minuteKey } },
    create: { userId, minuteKey, count: 1 },
    update: { count: { increment: 1 } },
  });
  return row.count <= perMinute;
}

export const VOICE_LIMITS = {
  maxBytes: 25 * 1024 * 1024, // 25MB（ASR 上限）
  maxSeconds: 30,             // 30s（ASR 上限）
  maxTextChars: 500,          // TTS 单次文本上限
} as const;
