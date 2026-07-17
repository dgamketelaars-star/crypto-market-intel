import { useSyncExternalStore } from 'react';
import { useSystemDSetups } from '../useSystemDSetups';
import { toIchimokuAnalysisSetup } from '../adapters/toIchimokuAnalysisSetup';
import { SYSTEM_D_PROVENANCE } from '../metadata/provenance';
import { marketDataStore } from '../../../store/marketDataStore';
import { Badge } from '../../../components/ui/Badge';
import { formatChangeTimestamp, formatUsdPrice } from '../../../utils/format';

function useLivePrice(symbol: string): number | null {
  const bySymbol = useSyncExternalStore(marketDataStore.subscribe, () => marketDataStore.getState().bySymbol);
  return bySymbol[symbol]?.ticker?.lastPrice ?? null;
}

function SystemDSetupCard({ setup }: { setup: ReturnType<typeof useSystemDSetups>[number] }) {
  const price = useLivePrice(setup.symbol);
  const normalised = toIchimokuAnalysisSetup(setup);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-100">{setup.symbol}</span>
        <Badge tone={setup.direction === 'LONG' ? 'long' : 'short'}>{setup.direction}</Badge>
        <Badge tone={normalised.status === 'active' ? 'accent' : normalised.status === 'entry_zone_now' ? 'amber' : 'neutral'}>{normalised.status}</Badge>
        <Badge tone={normalised.confidence === 'strong' ? 'calculated' : 'neutral'}>{normalised.confidence === 'strong' ? 'Sterk signaal' : 'Gematigd signaal'}</Badge>
        <span className="ml-auto text-xs text-slate-500">Live: {formatUsdPrice(price ?? undefined)}</span>
      </div>

      <p className="mb-2 text-xs text-slate-400">{normalised.marketInterpretation}</p>
      <p className="mb-2 text-xs text-slate-500">{normalised.setupType}</p>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-400 sm:grid-cols-4">
        <div>Entry: <span className="text-slate-200">{formatUsdPrice(normalised.entryZone?.low)}–{formatUsdPrice(normalised.entryZone?.high)}</span></div>
        <div>Stop: <span className="text-slate-200">{formatUsdPrice(normalised.stopPrice)}</span></div>
        <div>Doel: <span className="text-slate-200">{formatUsdPrice(normalised.targets?.[0]?.price)}</span></div>
        <div>Verwachte duur: <span className="text-slate-200">{normalised.expectedDuration}</span></div>
      </div>

      <p className="mt-2 text-xs text-slate-500">{normalised.invalidationReason}</p>

      <ul className="mt-2 space-y-1 text-xs text-slate-400">
        {normalised.supportingObservations.map((line, i) => (
          <li key={i}>• {line}</li>
        ))}
      </ul>
      {normalised.opposingObservations.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-amber-500/80">
          {normalised.opposingObservations.map((line, i) => (
            <li key={i}>⚠ {line}</li>
          ))}
        </ul>
      )}

      <p className="mt-2 text-xs text-slate-600">Data: {formatChangeTimestamp(normalised.dataTimestamp)}</p>
    </div>
  );
}

export function SystemDPanel() {
  const setups = useSystemDSetups()
    .filter((s) => s.status === 'entry_zone_now' || s.status === 'active')
    .sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-400">
        <div className="mb-1 text-sm font-semibold text-slate-200">{SYSTEM_D_PROVENANCE.displayName}</div>
        <div>
          Formule-referentie: <span className="text-slate-300">{SYSTEM_D_PROVENANCE.sourceRepository}</span> ({SYSTEM_D_PROVENANCE.sourceFile})
        </div>
        <div>
          Licentie: <span className="text-slate-300">{SYSTEM_D_PROVENANCE.licence}</span>
        </div>
        <div className="mt-2 text-slate-500">
          Tenkan-sen, Kijun-sen, Senkou Span A/B en Chikou Span zijn getrouw herimplementeerd; TK-cross-, kumo-breakout-, kijun-bounce- en
          sterkte-weging zijn onze eigen assemblage bovenop die formules (zie provenance.ts).
        </div>
      </div>

      {setups.length === 0 ? (
        <p className="text-sm text-slate-500">Geen actieve of net getriggerde setups van dit model.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {setups.map((setup) => (
            <SystemDSetupCard key={setup.id} setup={setup} />
          ))}
        </div>
      )}
    </div>
  );
}
