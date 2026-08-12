/**
 * GET /api/credit/estimate?feature=pdf&pages=10 | ?feature=text&chars=2000
 * 预计消耗（服务端按 PricingRule 计算，前端永不算价）
 */
import { NextRequest, NextResponse } from 'next/server';
import { estimateCredits } from '@/lib/credit/pricing';
import { FEATURES } from '@/lib/credit/types';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const feature = sp.get('feature') || '';
  const pages = parseInt(sp.get('pages') || '0', 10);
  const chars = parseInt(sp.get('chars') || '0', 10);
  const minutes = parseInt(sp.get('minutes') || '0', 10);

  let credits: number | null = null;
  if (feature === 'pdf') credits = (await estimateCredits(FEATURES.PDF, pages))?.credits ?? null;
  else if (feature === 'text') credits = (await estimateCredits(FEATURES.TEXT, Math.max(0, Math.round(chars / 1000))))?.credits ?? null;
  else if (feature === 'polish') credits = (await estimateCredits(FEATURES.POLISH, Math.max(0, Math.round(chars / 1000))))?.credits ?? null;
  else if (feature === 'image') credits = (await estimateCredits(FEATURES.IMAGE, 1))?.credits ?? null;
  else if (feature === 'subtitle') credits = (await estimateCredits(FEATURES.SUBTITLE, Math.max(0, Math.round(minutes / 1))))?.credits ?? null;
  else if (feature === 'doc') credits = (await estimateCredits(FEATURES.DOC, Math.max(0, Math.round(chars / 1000))))?.credits ?? null;
  else if (feature === 'web') credits = (await estimateCredits(FEATURES.WEB, Math.max(0, Math.round(chars / 1000))))?.credits ?? null;
  else if (feature === 'voice') {
    // 语音组合估算：STT(按秒) + 翻译(代表值1千字) + TTS(代表值1千字)
    const secs = Math.max(1, Math.min(120, parseInt(sp.get('seconds') || '15', 10)));
    const stt = (await estimateCredits(FEATURES.STT, Math.ceil(secs / 60)))?.credits ?? 1;
    const txt = (await estimateCredits(FEATURES.TEXT, 1))?.credits ?? 1;
    const tts = (await estimateCredits(FEATURES.TTS, 1))?.credits ?? 1;
    credits = stt + txt + tts;
  }

  return NextResponse.json({ feature, credits });
}
