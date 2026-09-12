import { permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';

/** V1.1 P1-5：/understand/dictionary 与 /untranslatable 同构重复，301 收敛到 /untranslatable */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: '难翻译词词典 | 爱翻译' };

export default function RedirectPage() {
  permanentRedirect('/untranslatable');
}
