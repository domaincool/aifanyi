/**
 * 字幕解析/生成（SRT / VTT）
 * SRT: 序号 + HH:MM:SS,mmm --> HH:MM:SS,mmm + 文本（可多行）
 * VTT: WEBVTT 头 + HH:MM:SS.mmm --> ...
 */

export interface SubtitleCue {
  index: number;
  start: string;   // 原始时间轴起始（如 00:00:01,000）
  end: string;     // 原始时间轴结束
  text: string;    // 文本（多行合并为 \n）
}

/** 解析 SRT/VTT 文本为 cues */
export function parseSubtitle(raw: string): { cues: SubtitleCue[]; format: 'srt' | 'vtt'; error?: string } {
  let text = raw.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '');
  const isVtt = /^\s*WEBVTT/.test(text);
  const isSrt = !isVtt && /-->/.test(text);

  if (!isVtt && !isSrt) {
    return { cues: [], format: 'srt', error: '无法识别的字幕格式，请上传 SRT 或 VTT 文件。' };
  }

  // 去掉 VTT 头部（WEBVTT 及可能的说明行）
  if (isVtt) {
    const lines = text.split('\n');
    let idx = 0;
    while (idx < lines.length && !lines[idx].includes('-->')) idx++;
    // 保留从第一个时间轴开始的内容，但去掉 NOTE 等
    text = lines.slice(idx).join('\n');
  }

  const cuePattern = /(?:(\d+)\s*\n)?(\d{1,2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{3})([^\n]*)\n([\s\S]*?)(?=\n\s*\n|$)/g;

  const cues: SubtitleCue[] = [];
  let m: RegExpExecArray | null;
  let indexCounter = 1;
  while ((m = cuePattern.exec(text)) !== null) {
    const start = m[2].replace(',', ',');
    const end = m[3].replace(',', ',');
    // 清理设置行（VTT 的 position:... 等）
    let body = m[5].trim().replace(/<[^>]+>/g, '');
    if (!body) continue;
    // VTT 多行 cue 去多余空行
    body = body.split('\n').filter(l => l.trim()).join('\n');
    const idx = m[1] ? parseInt(m[1], 10) : indexCounter++;
    cues.push({ index: idx, start, end, text: body });
  }

  if (cues.length === 0) {
    return { cues: [], format: isVtt ? 'vtt' : 'srt', error: '字幕中没有可解析的时间轴条目。' };
  }
  return { cues, format: isVtt ? 'vtt' : 'srt' };
}

/** 生成 SRT 文本（cues 需含 translation，可双语） */
export function buildSrt(cues: { index: number; start: string; end: string; text: string; translation?: string }[], bilingual = true): string {
  return cues.map(c => {
    const s = c.start.replace('.', ',');
    const e = c.end.replace('.', ',');
    const lines = [String(c.index), `${s} --> ${e}`];
    if (bilingual && c.translation && c.translation !== c.text) {
      lines.push(c.text);
      lines.push(c.translation);
    } else {
      lines.push(c.translation || c.text);
    }
    return lines.join('\n');
  }).join('\n\n') + '\n';
}

/** 生成纯译文 SRT */
export function buildSrtTargetOnly(cues: { index: number; start: string; end: string; text: string; translation?: string }[]): string {
  return buildSrt(cues, false);
}

/** 时间轴字符串转秒（用于校验/排序） */
export function timeToSeconds(t: string): number {
  const m = t.match(/(\d+):(\d{2}):(\d{2})[,.](\d{3})/);
  if (!m) return 0;
  return parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10) + parseInt(m[4], 10) / 1000;
}
