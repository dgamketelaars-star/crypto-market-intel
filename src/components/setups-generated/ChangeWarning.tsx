import { formatChangeTimestamp } from '../../utils/format';

/** The only place a "something changed" notice appears — directly above the plan section it applies to, never in a separate changelog/update block. */
export function ChangeWarning({ label, timestamp }: { label: string; timestamp: number }) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-400">
      <span aria-hidden="true">⚠️</span>
      <span>{label} gewijzigd</span>
      <span className="font-normal text-slate-500">• {formatChangeTimestamp(timestamp)}</span>
    </div>
  );
}
