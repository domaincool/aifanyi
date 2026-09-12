import MemeEntryView, { buildMemeMetadata } from '@/components/content/MemeEntryView';

/** 梗词条 SEO 页：/meme/[slug]（zh 词条主 URL；en 词条 301 到 Meaning URL）__p0fix-loop__ */
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return buildMemeMetadata(slug);
}

export default async function MemePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return MemeEntryView({ slug, isMeaningRoute: false });
}
