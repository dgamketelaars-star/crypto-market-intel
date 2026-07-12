import type { SetupTarget } from '../../setups/engine/types';
import { formatUsdPrice } from '../../utils/format';

const statusLabel: Record<SetupTarget['status'], string> = {
  pending: 'In afwachting',
  reached: 'Deels gerealiseerd',
  completed: 'Voltooid',
};

const statusTone: Record<SetupTarget['status'], string> = {
  pending: 'text-slate-400',
  reached: 'text-amber-400',
  completed: 'text-emerald-400',
};

/**
 * Renders the staged-exit target plan: order, price, suggested position
 * portion, reward:risk and status. No distance-to-target percentage — the
 * live price is already shown at the top of the card, so the trader can see
 * directly where price sits relative to each level. Portions always sum to
 * 100 (see targetPortions.ts) — this list only displays the plan, it never
 * recomputes it.
 */
export function TargetPlanList({ targets }: { targets: SetupTarget[] }) {
  if (targets.length === 0) {
    return <p className="text-xs text-slate-500">Geen koersdoel — er is geen niveau dat aan de minimale reward:risk-eis voldoet.</p>;
  }

  return (
    <div className="space-y-2">
      {targets.map((target) => (
        <div
          key={target.order}
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] font-semibold text-slate-300">
              {target.order}
            </span>
            <div>
              <span className="text-sm font-medium text-slate-100">{formatUsdPrice(target.price)}</span>
              <span className="ml-2 text-xs text-slate-500">{target.positionPortionPct}% van plan</span>
              {target.isFinal && <span className="ml-1 text-[10px] tracking-wide text-slate-500 uppercase">· final</span>}
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            {target.rewardToRisk !== null && <span className="text-slate-400">R:R {target.rewardToRisk.toFixed(1)}</span>}
            <span className={`font-medium ${statusTone[target.status]}`}>{statusLabel[target.status]}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
