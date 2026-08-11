import { NextResponse } from 'next/server';
import { getGoogleAuthUrl } from '@/lib/auth/google';

export const runtime = 'nodejs';

export async function GET() {
  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://aifanyi.com'}/api/auth/google/callback`;
  const url = getGoogleAuthUrl(redirectUri);
  return NextResponse.redirect(url);
}