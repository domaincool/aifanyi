'use client';

export default function UsageBar({ used, limit, label }: { used: number; limit: number; label: string }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const remaining = Math.max(0, limit - used);
  return (
    <div className="usage-bar-wrap">
      <div className="usage-bar-label">{label}：{used} / {limit}</div>
      <div className="usage-bar-track"><div className="usage-bar-fill" style={{ width: pct + '%' }} /></div>
      <div className="usage-bar-remaining">剩余 {remaining}</div>
    </div>
  );
}