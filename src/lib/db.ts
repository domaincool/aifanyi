import { PrismaClient } from '@prisma/client';

// 全局单例，避免 dev 热重载时连接泄漏
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
