import { useMemo, useState } from 'react';
import { useGeneratedSetups, useIsSetupGenerationRecalibrating } from '../../hooks/useGeneratedSetups';
import { useShowSetupDebugPanel } from '../../hooks/useDevToggles';
import { SETUP_GENERATION_PAUSED_MESSAGE } from '../../intelligence/generationStatus';
import { selectVisibleSetups } from '../../setups/engine/visibleSetupSelection';
import { getDisplayStatus, type SetupDisplayStatus } from '../../setups/explanations/displayStatus';
import type { GeneratedSetup } from '../../setups/engine/types';
import { DebugSetupStatePanel } from './DebugSetupStatePanel';
import { GeneratedSetupCard } from './GeneratedSetupCard';
import { SetupFilterTabs, type SetupFilterValue } from './SetupFilterTabs';

const DISPLAY_ORDER: Record<SetupDisplayStatus, number> = { active: 0, entry_zone: 1, waiting_entry: 2, closed: 3 };

function applyDirectionFilter(setups: GeneratedSetup[], filter: SetupFilterValue): GeneratedSetup[] {
  if (filter === 'long') return setups.filter((s) => s.direction === 'LONG');
  if (filter === 'short') return setups.filter((s) => s.direction === 'SHORT');
  return setups;
}

/**
 * One flowing list of setups that are currently relevant. Two gates run
 * before anything reaches the screen:
 *  1. Closed setups (invalidated/completed/expired) are filtered out —
 *     they stay in the store for lifecycle history, debugging and future
 *     analytics, they just never render here.
 *  2. At most one setup per symbol: LONG/SHORT proposals for the same
 *     symbol are compared and only the dominant direction (if any) is
 *     shown — see selectVisibleSetups. A symbol with no clear winner shows
 *     nothing, for either direction.
 * Both gates run in the engine layer, not as UI-only filtering, so there is
 * no code path in the normal view that can render a closed setup or two
 * opposite-direction setups for the same symbol at once.
 */
export function GeneratedSetupsSection() {
  const setups = useGeneratedSetups();
  const recalibrating = useIsSetupGenerationRecalibrating();
  const [filter, setFilter] = useState<SetupFilterValue>('all');
  const [showDebug] = useShowSetupDebugPanel();

  const { visible } = useMemo(() => selectVisibleSetups(setups), [setups]);

  const filtered = applyDirectionFilter(visible, filter)
    .slice()
    .sort((a, b) => {
      const order = DISPLAY_ORDER[getDisplayStatus(a.status)] - DISPLAY_ORDER[getDisplayStatus(b.status)];
      return order !== 0 ? order : b.lastEvaluatedAt - a.lastEvaluatedAt;
    });

  if (recalibrating) {
    return (
      <div className="space-y-6">
        <p className="rounded-lg border border-dashed border-slate-800 p-4 text-center text-sm text-slate-500">
          {SETUP_GENERATION_PAUSED_MESSAGE}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">Calculated from live Binance market data — geen trading-signaal.</p>
        <SetupFilterTabs value={filter} onChange={setFilter} />
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-800 p-4 text-center text-sm text-slate-500">
          Geen setups die momenteel voldoen aan de kwaliteitscriteria.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filtered.map((setup) => (
            <GeneratedSetupCard key={setup.id} setup={setup} />
          ))}
        </div>
      )}

      {showDebug && (
        <section>
          <DebugSetupStatePanel />
        </section>
      )}
    </div>
  );
}
