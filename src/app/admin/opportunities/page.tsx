/**
 * /admin/opportunities — 内容机会查看页（只读）
 * 数据来自 recordLanguageIntent 的实时聚合（meaning / hidden_meaning / speak 三类意图）。
 * status 恒为 candidate，不自动发布；是否创建对应内容页由人工判断。
 */
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const metadata = { title: '内容机会（管理员） | 爱翻译' };

function fmtDate(d: Date) {
  return new Date(d).toISOString().slice(0, 16).replace('T', ' ');
}

function suggestUrl(intent: string, term: string): string | null {
  if (intent === 'meaning' || intent === 'hidden_meaning') return `/understand/meaning/${encodeURIComponent(term)}`;
  if (intent === 'speak') return '/speak';
  return null;
}

export default async function AdminOpportunitiesPage() {
  const [top, coveredCount, totalCount] = await Promise.all([
    prisma.contentOpportunity.findMany({
      where: { covered: false },
      orderBy: [{ score: 'desc' }, { lastSeenAt: 'desc' }],
      take: 100,
    }),
    prisma.contentOpportunity.count({ where: { covered: true } }),
    prisma.contentOpportunity.count(),
  ]);

  return (
    <div>
      <h1 style={{ fontSize: 24, margin: '0 0 4px' }}>内容机会</h1>
      <p style={{ color: 'var(--muted)', margin: '0 0 20px' }}>
        来自用户真实搜索意图的候选词。只读查看，不自动发布；是否创建对应内容页由人工判断。
      </p>
      <div style={{ display: 'flex', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>待处理候选：{top.length}</span>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>已覆盖：{coveredCount}</span>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>总计：{totalCount}</span>
      </div>
      {top.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>
          暂无候选。用户使用「词义快答 / 隐藏含义 / 怎么说」类意图提问时，会自动聚合到这里。
        </p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead>
            <tr>
              {['候选词', '意图', '热度', '原始问法（最多 3 条）', '最近出现', '建议落点'].map((h) => (
                <th key={h} style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', padding: '8px 10px' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {top.map((o) => {
              const url = suggestUrl(o.intent, o.candidateTerm);
              return (
                <tr key={o.id}>
                  <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 10px', fontWeight: 600 }}>{o.candidateTerm}</td>
                  <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 10px' }}>{o.intent}</td>
                  <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 10px' }}>{o.hits}</td>
                  <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 10px', color: 'var(--muted)' }}>
                    {o.variants.slice(0, 3).join(' / ')}
                  </td>
                  <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 10px', color: 'var(--muted)' }}>{fmtDate(o.lastSeenAt)}</td>
                  <td style={{ borderBottom: '1px solid var(--border)', padding: '8px 10px' }}>
                    {url ? (
                      <a href={url} style={{ color: 'var(--accent2, var(--accent))' }}>{url}</a>
                    ) : (
                      <span style={{ color: 'var(--muted)' }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
