import MemeEntryView, { buildMemeMetadata } from '@/components/content/MemeEntryView';

/** /understand/meaning/[slug]：en 词条的稳定 Meaning URL（薄包装；本页自服务，不再自指跳转）__p0fix-loop__ */
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return buildMemeMetadata(slug);
}

export default async function MeaningSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return MemeEntryView({ slug, isMeaningRoute: true });
}
