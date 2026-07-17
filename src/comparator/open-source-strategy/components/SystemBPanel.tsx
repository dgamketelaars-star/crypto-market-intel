import { useSystemBSetups } from '../useSystemBSetups';
import { toNormalisedStrategySetup } from '../adapters/toNormalisedSetup';
import { SYSTEM_B_PROVENANCE } from '../metadata/provenance';
import { SYSTEM_B_LIMITATIONS } from '../metadata/strategyLimitations';
import { marketDataStore } from '../../../store/marketDataStore';
import { useSyncExternalStore } from 'react';
import { Badge } from '../../../components/ui/Badge';
import { formatChangeTimestamp, formatUsdPrice } from '../../../utils/format';

function useLivePrice(symbol: string): number | null {
  const bySymbol = useSyncExternalStore(marketDataStore.subscribe, () => marketDataStore.getState().bySymbol);
  return bySymbol[symbol]?.ticker?.lastPrice ?? null;
}

function SystemBSetupCard({ setup }: { setup: ReturnType<typeof useSystemBSetups>[number] }) {
  const price = useLivePrice(setup.symbol);
  const normalised = toNormalisedStrategySetup(setup, Date.now());

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-100">{setup.symbol}</span>
        <Badge tone={setup.direction === 'LONG' ? 'long' : 'short'}>{setup.direction}</Badge>
        <Badge tone={normalised.status === 'active' ? 'accent' : normalised.status === 'entry_triggered' ? 'amber' : 'neutral'}>{normalised.status}</Badge>
        <span className="ml-auto text-xs text-slate-500">Live: {formatUsdPrice(price ?? undefined)}</span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-400 sm:grid-cols-3">
        <div>Trigger: <span className="text-slate-200">{formatUsdPrice(normalised.triggerPrice)}</span></div>
        <div>Stop: <span className="text-slate-200">{formatUsdPrice(normalised.stopPrice)}</span></div>
        <div>Data: <span className="text-slate-200">{formatChangeTimestamp(normalised.sourceDataTimestamp)}</span></div>
      </div>

      <p className="mt-2 text-xs text-slate-500">{normalised.exitMethod}</p>

      <ul className="mt-2 space-y-1 text-xs text-slate-400">
        {normalised.reasonSummary.map((line, i) => (
          <li key={i}>• {line}</li>
        ))}
      </ul>
    </div>
  );
}

export function SystemBPanel() {
  const setups = useSystemBSetups()
    .filter((s) => s.status === 'entry_triggered' || s.status === 'active')
    .sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-400">
        <div className="mb-1 text-sm font-semibold text-slate-200">{SYSTEM_B_PROVENANCE.displayName}</div>
        <div>
          Bron: <span className="text-slate-300">{SYSTEM_B_PROVENANCE.sourceRepository}</span> ({SYSTEM_B_PROVENANCE.sourceFile})
        </div>
        <div>
          Versie/commit: <span className="text-slate-300">{SYSTEM_B_PROVENANCE.sourceCommit.slice(0, 7)}</span> · Licentie: <span className="text-slate-300">{SYSTEM_B_PROVENANCE.licence}</span>
        </div>
        <div className="mt-2 text-slate-500">Onafhankelijke, getrouwe herimplementatie in TypeScript — geen upstream-endorsement. Zie provenance.ts voor volledige details.</div>
        <details className="mt-2">
          <summary className="cursor-pointer text-slate-400">Bekende beperkingen van de originele strategie ({SYSTEM_B_LIMITATIONS.length})</summary>
          <ul className="mt-1 space-y-1 pl-3">
            {SYSTEM_B_LIMITATIONS.map((l, i) => (
              <li key={i} className="list-disc text-slate-500">{l}</li>
            ))}
          </ul>
        </details>
      </div>

      {setups.length === 0 ? (
        <p className="text-sm text-slate-500">Geen actieve of net getriggerde setups van dit model.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {setups.map((setup) => (
            <SystemBSetupCard key={setup.id} setup={setup} />
          ))}
        </div>
      )}
    </div>
  );
}
