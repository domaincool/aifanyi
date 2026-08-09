import { NextRequest, NextResponse } from 'next/server';
import { translator } from '@/lib/translator/router';

/**
 * POST /api/explain
 * 「AI 为什么这样翻译？」：输入原文+译文，返回三段式讲解（语气/场景/本地化/为什么）。
 * 按需调用，失败可降级（不影响翻译主链路）。
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sourceText, targetText, sourceLang = 'zh', targetLang = 'en', scenario = 'auto' } = body;

    if (!sourceText || !targetText) {
      return NextResponse.json({ error: 'sourceText 与 targetText 不能为空' }, { status: 400 });
    }

    const result = await translator.translate({
      text: `${sourceText}\n---\n${targetText}`,
      sourceLang: targetLang,
      targetLang,
      scenario: 'explain',
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    // 解析四行输出（容错：缺失字段留空）
    const raw = result.text;
    const parse = (key: string) => {
      const m = raw.match(new RegExp(`${key}[:：]\\s*([^\\n]+)`));
      return m ? m[1].trim() : '';
    };
    const tone = parse('语气') || parse('tone');
    const scene = parse('场景') || parse('scene');
    const localization = parse('本地化') || parse('localization');
    const why = parse('为什么') || parse('why') || raw.slice(0, 300);

    return NextResponse.json({ tone, scene, localization, why, model: result.model, cached: result.cached ?? false });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '服务器错误' }, { status: 500 });
  }
}