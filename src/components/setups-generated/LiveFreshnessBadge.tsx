import { useNow } from '../../hooks/useNow';
import { classifyFreshness } from '../../utils/freshness';
import { formatClockTime } from '../../utils/format';

const config = {
  live: { dot: 'bg-emerald-400', text: 'text-emerald-400', label: 'Live' },
  delayed: { dot: 'bg-amber-400', text: 'text-amber-400', label: 'Delayed' },
  stale: { dot: 'bg-rose-400', text: 'text-rose-400', label: 'Stale' },
};

/** Live/Delayed/Stale read for one data point (e.g. a symbol's live price feed) — distinct from the global connection status bar. */
export function LiveFreshnessBadge({ updatedAt, showTime = true }: { updatedAt: number | undefined; showTime?: boolean }) {
  const now = useNow(5_000);
  const level = classifyFreshness(updatedAt, now);
  const cfg = config[level];

  return (
    <span className={`flex items-center gap-1.5 text-xs font-medium ${cfg.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
      {showTime && <span className="text-slate-500">· {formatClockTime(updatedAt)}</span>}
    </span>
  );
}
