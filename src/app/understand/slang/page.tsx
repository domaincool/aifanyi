import { permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';

/** V1.1 P1-5：/understand/slang 与 /meme 同构重复，301 收敛到 /meme */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: '网络用语与俚语 | 爱翻译' };

export default function RedirectPage() {
  permanentRedirect('/meme');
}
