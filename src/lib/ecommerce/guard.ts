/**
 * 跨境电商工作台 · 权限与归属守卫
 * 复用 Credit 系统的 getAuthUserId（登录态）；所有用户数据访问强制归属校验（IDOR 防护）
 */
import { NextResponse } from 'next/server';
import { getAuthUserId, authErrorBody } from '@/lib/credit/sync-settle';
import { prisma } from '@/lib/db';

export type EcomUser = { userId: string };

/** 认证：未登录返回 401 文案，登录返回 userId */
export async function requireEcomUser(): Promise<EcomUser | NextResponse> {
  const auth = await getAuthUserId();
  if (!auth) return NextResponse.json(authErrorBody(), { status: 401 });
  return auth;
}

/** project 归属当前用户 */
export async function assertProjectOwned(userId: string, projectId: string): Promise<boolean> {
  const p = await prisma.ecommerceProject.findFirst({ where: { id: projectId, userId }, select: { id: true } });
  return !!p;
}

/** product 归属当前用户 */
export async function assertProductOwned(userId: string, productId: string): Promise<boolean> {
  const p = await prisma.ecommerceProduct.findFirst({ where: { id: productId, userId }, select: { id: true } });
  return !!p;
}

/** 获取或自动创建默认项目（Product-first UX：进入工作台直接看商品，不强迫理解 Project） */
export async function getOrCreateDefaultProject(userId: string): Promise<{ id: string; name: string }> {
  const existing = await prisma.ecommerceProject.findFirst({
    where: { userId, status: 'active' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true },
  });
  if (existing) return existing;
  return prisma.ecommerceProject.create({
    data: { userId, name: '默认项目' },
    select: { id: true, name: true },
  });
}
