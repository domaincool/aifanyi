/**
 * 全局错误落库（审计 P2「无监控」修复）
 * uncaughtException → 记录后退出（PM2 自动重启）
 * unhandledRejection → 记录后继续运行（不崩）
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { prisma } = await import('@/lib/db');

    const logError = (type: string, message: string, stack?: string) => {
      prisma.errorLog
        .create({
          data: {
            type,
            message: (message || '').slice(0, 2000),
            stack: stack ? stack.slice(0, 8000) : null,
          },
        })
        .catch(() => {
          /* DB 断开时写失败忽略，避免连锁错误 */
        });
    };

    process.on('uncaughtException', (err) => {
      // 尽力记录后退出，交给 PM2 重启
      logError('uncaughtException', err.message, err.stack);
      setTimeout(() => process.exit(1), 200);
    });

    process.on('unhandledRejection', (reason) => {
      const msg = reason instanceof Error ? reason.message : String(reason);
      const stack = reason instanceof Error ? reason.stack : undefined;
      logError('unhandledRejection', msg, stack);
    });
  }
}
