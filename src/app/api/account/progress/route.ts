import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { documentId, lastPage, lastBlockId } = await req.json();
  if (!documentId || typeof lastPage !== 'number') {
    return NextResponse.json({ ok: false, message: 'documentId 和 lastPage 为必填' }, { status: 400 });
  }

  await prisma.documentProgress.upsert({
    where: { userId_documentId: { userId: auth.user.userId, documentId } },
    create: { userId: auth.user.userId, documentId, lastPage, lastBlockId },
    update: { lastPage, lastBlockId },
  });

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const documentId = new URL(req.url).searchParams.get('documentId');
  if (!documentId) return NextResponse.json({ ok: false, message: 'documentId 为必填' }, { status: 400 });

  const progress = await prisma.documentProgress.findUnique({
    where: { userId_documentId: { userId: auth.user.userId, documentId } },
  });

  return NextResponse.json({ progress });
}