import { permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';

/** V1.1 P1-5：/understand/idioms 与 /idioms 同构重复，301 收敛到 /idioms */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: '成语谚语翻译 | 爱翻译' };

export default function RedirectPage() {
  permanentRedirect('/idioms');
}
