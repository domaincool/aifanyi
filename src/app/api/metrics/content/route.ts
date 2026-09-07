import { NextResponse } from 'next/server';
import { recordContentEvent, recordContentView, getTouchAttribution } from '@/lib/metrics/server';

/**
 * 内容埋点接收 API（流量增长 V1.0 Week1 D5）
 * POST /api/metrics/content
 * { event: 'pageview' | 'tool_click' | 'signup' | 'first_translation' | 'credit_consume',
 *   contentType, contentId, contentSessionId? }
 * 防滥用：仅接受白名单事件与短字符串字段；无鉴权（匿名计数设计）
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return NextResponse.json({ ok: false }, { status: 400 });

    const { event, contentType, contentId, contentSessionId } = body as Record<string, unknown>;
    if (typeof event !== 'string' || typeof contentType !== 'string' || typeof contentId !== 'string') {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    // 字段长度限制（防垃圾数据）
    if (contentType.length > 32 || contentId.length > 256 || (typeof contentSessionId === 'string' && contentSessionId.length > 64)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    if (event === 'pageview') {
      await recordContentView(contentType, contentId, typeof contentSessionId === 'string' ? contentSessionId : null);
    } else if (event === 'tool_click' || event === 'signup' || event === 'first_translation' || event === 'credit_consume') {
      await recordContentEvent(event, contentType, contentId);
      // signup/首翻时附带回传触点归因（供日志侧使用，P5）
      if ((event === 'signup' || event === 'first_translation') && typeof contentSessionId === 'string') {
        await getTouchAttribution(contentSessionId).catch(() => null);
      }
    } else {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
