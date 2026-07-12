import { useMemo } from 'react';
import { useGeneratedSetups, useSetupResolutions } from '../../hooks/useGeneratedSetups';
import { selectVisibleSetups } from '../../setups/engine/visibleSetupSelection';
import { getDisplayStatus } from '../../setups/explanations/displayStatus';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';

/**
 * Internal/debug-only view of the setup engine's state:
 *  - the engine's own per-tick activation-time conflict resolution
 *    (resolveSymbolDirection — decides which direction is allowed to
 *    activate at all);
 *  - the display-layer visibility resolution (selectVisibleSetups —
 *    decides which single open setup, if any, a normal user would see for
 *    each symbol right now, including symbols hidden entirely because
 *    neither direction clearly dominates);
 *  - a count confirming closed setups are still held in the store (for
 *    lifecycle history / future analytics) even though none of them ever
 *    reach the normal view.
 * Gated behind a dev toggle — never shown to normal users.
 */
export function DebugSetupStatePanel() {
  const setups = useGeneratedSetups();
  const resolutions = useSetupResolutions();
  const { visible, bySymbol } = useMemo(() => selectVisibleSetups(setups), [setups]);

  const closedCount = setups.filter((s) => getDisplayStatus(s.status) === 'closed').length;
  const symbolsWithResolution = Object.entries(resolutions).filter(([, r]) => r.outcome !== 'no_setup');
  const visibilityEntries = Object.entries(bySymbol);

  return (
    <Card className="border-violet-500/30 bg-violet-500/[0.03] p-5">
      <div className="mb-4 flex items-center gap-2 rounded-md bg-violet-500/10 px-3 py-2 ring-1 ring-inset ring-violet-500/30">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
        <p className="text-xs font-semibold tracking-wide text-violet-400 uppercase">
          Internal setup-engine state — debug only, not shown to normal users
        </p>
      </div>

      <p className="mb-5 text-xs text-slate-500">
        {setups.length} setups totaal in de store · {visible.length} zichtbaar in de normale UI · {closedCount} afgesloten
        (bewaard voor lifecycle-geschiedenis en analytics, nooit getoond).
      </p>

      <div className="mb-5">
        <p className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
          Zichtbaarheids-resolutie per symbool (weergavelaag)
        </p>
        {visibilityEntries.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-800 p-3 text-center text-xs text-slate-500">
            Geen open setups op dit moment.
          </p>
        ) : (
          <div className="space-y-2">
            {visibilityEntries.map(([symbol, v]) => (
              <div key={symbol} className="rounded-md border border-slate-800 bg-slate-950/40 p-3 text-xs">
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-semibold text-slate-200">{symbol}</span>
                  <Badge tone={v.outcome === 'long' ? 'long' : v.outcome === 'short' ? 'short' : 'amber'}>{v.outcome}</Badge>
                  <span className="text-slate-500">
                    LONG score {v.longScore} · SHORT score {v.shortScore}
                  </span>
                </div>
                <p className="text-slate-400">{v.reason}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
          Activatie-conflict-resolutie per symbool (engine, per tick)
        </p>
        {symbolsWithResolution.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-800 p-3 text-center text-xs text-slate-500">
            Geen symbolen met actieve of tegenstrijdige richtingsscores op dit moment.
          </p>
        ) : (
          <div className="space-y-2">
            {symbolsWithResolution.map(([symbol, r]) => (
              <div key={symbol} className="rounded-md border border-slate-800 bg-slate-950/40 p-3 text-xs">
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-semibold text-slate-200">{symbol}</span>
                  <Badge tone={r.outcome === 'active_long' ? 'long' : r.outcome === 'active_short' ? 'short' : 'amber'}>
                    {r.outcome}
                  </Badge>
                  <span className="text-slate-500">
                    LONG score {r.long.netScore} ({r.long.qualifies ? 'qualifies' : 'no'}) · SHORT score {r.short.netScore} (
                    {r.short.qualifies ? 'qualifies' : 'no'})
                  </span>
                </div>
                <p className="text-slate-400">{r.reason}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
