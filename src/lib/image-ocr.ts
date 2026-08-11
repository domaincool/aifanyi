/**
 * 图片 OCR（GLM-4V-Flash 免费视觉模型）
 * 输入 base64 图片 → 输出逐行文字
 */
export async function ocrImage(base64: string, mime: string): Promise<{ text: string; error?: string }> {
  const apiKey = process.env.GLM_API_KEY || '';
  if (!apiKey) return { text: '', error: 'GLM_API_KEY 未配置' };

  const res = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'glm-4v-flash',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
            {
              type: 'text',
              text: '请识别这张图片中的所有文字。要求：1. 按阅读顺序逐行输出，每行一条；2. 只输出识别到的文字本身，不要任何解释、编号或额外内容；3. 识别不清的内容跳过不输出；4. 如果图片中没有任何文字，只输出「（图片中没有文字）」',
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 1024,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    return { text: '', error: `OCR 服务错误：${data?.error?.message || res.status}` };
  }
  const text = (data?.choices?.[0]?.message?.content || '').trim();
  if (!text) return { text: '', error: 'OCR 未能识别到文字。' };
  return { text };
}
