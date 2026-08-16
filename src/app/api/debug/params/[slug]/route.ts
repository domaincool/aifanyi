import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let decoded = slug;
  try { decoded = decodeURIComponent(slug); } catch { /* keep raw */ }
  return Response.json({
    raw: slug,
    rawLen: slug.length,
    decoded,
    decodedLen: decoded.length,
    rawChars: [...slug].map((c) => c.codePointAt(0)?.toString(16)).join(','),
    encoded: encodeURIComponent(slug),
  });
}
