import { useSyncExternalStore } from 'react';
import { useSystemCSetups } from '../useSystemCSetups';
import { toIndependentAnalysisSetup } from '../adapters/toIndependentAnalysisSetup';
import { SYSTEM_C_PROVENANCE } from '../metadata/provenance';
import { marketDataStore } from '../../../store/marketDataStore';
import { Badge } from '../../../components/ui/Badge';
import { formatChangeTimestamp, formatUsdPrice } from '../../../utils/format';

function useLivePrice(symbol: string): number | null {
  const bySymbol = useSyncExternalStore(marketDataStore.subscribe, () => marketDataStore.getState().bySymbol);
  return bySymbol[symbol]?.ticker?.lastPrice ?? null;
}

function SystemCSetupCard({ setup }: { setup: ReturnType<typeof useSystemCSetups>[number] }) {
  const price = useLivePrice(setup.symbol);
  const normalised = toIndependentAnalysisSetup(setup);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-100">{setup.symbol}</span>
        <Badge tone={setup.direction === 'LONG' ? 'long' : 'short'}>{setup.direction}</Badge>
        <Badge tone={normalised.status === 'active' ? 'accent' : normalised.status === 'entry_zone_now' ? 'amber' : 'neutral'}>{normalised.status}</Badge>
        <span className="ml-auto text-xs text-slate-500">Live: {formatUsdPrice(price ?? undefined)}</span>
      </div>

      <p className="mb-2 text-xs text-slate-400">{normalised.marketInterpretation}</p>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-400 sm:grid-cols-3">
        <div>Stop: <span className="text-slate-200">{formatUsdPrice(normalised.stopPrice)}</span></div>
        <div>Doel: <span className="text-slate-200">{formatUsdPrice(normalised.targets?.[0]?.price)}</span></div>
        <div>Data: <span className="text-slate-200">{formatChangeTimestamp(normalised.dataTimestamp)}</span></div>
      </div>

      <p className="mt-2 text-xs text-slate-500">{normalised.invalidationReason}</p>

      <ul className="mt-2 space-y-1 text-xs text-slate-400">
        {normalised.supportingObservations.map((line, i) => (
          <li key={i}>• {line}</li>
        ))}
      </ul>
    </div>
  );
}

export function SystemCPanel() {
  const setups = useSystemCSetups()
    .filter((s) => s.status === 'entry_zone_now' || s.status === 'active')
    .sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-400">
        <div className="mb-1 text-sm font-semibold text-slate-200">{SYSTEM_C_PROVENANCE.displayName}</div>
        <div>
          Primitieven uit: <span className="text-slate-300">{SYSTEM_C_PROVENANCE.sourceRepository}</span> ({SYSTEM_C_PROVENANCE.sourceFile})
        </div>
        <div>
          Versie/commit: <span className="text-slate-300">{SYSTEM_C_PROVENANCE.sourceCommit.slice(0, 7)}</span> · Licentie: <span className="text-slate-300">{SYSTEM_C_PROVENANCE.licence}</span>
        </div>
        <div className="mt-2 text-slate-500">
          Structuur- en liquidity-detectie zijn getrouw herimplementeerd; entry/stop/doel-regels zijn onze eigen assemblage bovenop die primitieven (zie provenance.ts).
        </div>
      </div>

      {setups.length === 0 ? (
        <p className="text-sm text-slate-500">Geen actieve of net getriggerde setups van dit model.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {setups.map((setup) => (
            <SystemCSetupCard key={setup.id} setup={setup} />
          ))}
        </div>
      )}
    </div>
  );
}
