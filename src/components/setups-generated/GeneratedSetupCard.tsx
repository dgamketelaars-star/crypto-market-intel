import type { GeneratedSetup } from '../../setups/engine/types';
import { useBinanceMarket } from '../../hooks/useBinanceMarket';
import { describeClosedReason, displayStatusConfig, getDisplayStatus } from '../../setups/explanations/displayStatus';
import { familyLabels, tradeHorizonLabels } from '../../setups/explanations/setupLabels';
import { formatUsdPrice } from '../../utils/format';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { Disclosure } from '../ui/Disclosure';
import { ChangeWarning } from './ChangeWarning';
import { GeneratedSourcesSection } from './GeneratedSourcesSection';
import { GeneratedTechnicalDetails } from './GeneratedTechnicalDetails';
import { GeneratedWhySection } from './GeneratedWhySection';
import { LifecycleHistoryList } from './LifecycleHistoryList';
import { LiveFreshnessBadge } from './LiveFreshnessBadge';
import { StrengthRiskMeter } from './StrengthRiskMeter';
import { TargetPlanList } from './TargetPlanList';

interface GeneratedSetupCardProps {
  setup: GeneratedSetup;
  /** Simulation setups have no real Binance ticker (the symbol doesn't exist on the exchange) — the simulation panel supplies its own synthetic tick price/time here instead. */
  priceOverride?: { price: number; updatedAt: number };
}

function formatEntryZoneValue(setup: GeneratedSetup): string {
  if (setup.entryZone) return `${formatUsdPrice(setup.entryZone.low)} – ${formatUsdPrice(setup.entryZone.high)}`;
  return `~ ${formatUsdPrice(setup.trigger.price)}`;
}

/**
 * The single card type for every setup, at every point in its life. It never
 * swaps to a different component as the setup progresses — the same card
 * just updates in place, exactly like the underlying handelsplan does. No
 * separate "candidate card" / "active card" / "closed card", no separate
 * update or changelog block: a field that changed gets a small warning
 * directly above that field, and nothing else moves.
 */
export function GeneratedSetupCard({ setup, priceOverride }: GeneratedSetupCardProps) {
  const market = useBinanceMarket(setup.symbol);
  const displayStatus = getDisplayStatus(setup.status);
  const statusCfg = displayStatusConfig[displayStatus];
  const isClosed = displayStatus === 'closed';

  const livePrice = priceOverride?.price ?? market?.ticker?.lastPrice ?? null;
  const priceUpdatedAt = priceOverride?.updatedAt ?? market?.updatedAt;
  const priceToShow = isClosed ? (setup.closedPrice ?? livePrice) : livePrice;

  return (
    <Card className={`flex flex-col p-5 ${isClosed ? 'opacity-90' : ''}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-lg font-semibold text-slate-100">{setup.symbol.replace(/USDT$/, '')}</h3>
            <Badge tone={setup.direction === 'LONG' ? 'long' : 'short'}>{setup.direction}</Badge>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">{familyLabels[setup.family]}</p>
          <div className="mt-1.5">
            <Badge tone="accent">{tradeHorizonLabels[setup.tradeHorizon]}</Badge>
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5 pt-1">
          <div className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
            <span className={`text-xs font-medium whitespace-nowrap ${statusCfg.text}`}>{statusCfg.label}</span>
          </div>
          {isClosed && <span className="text-[11px] text-slate-500">{describeClosedReason(setup.closedReason)}</span>}
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-slate-800 bg-slate-950/40 p-3.5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <span className="text-xs text-slate-500">{isClosed ? 'Slotprijs' : 'Live prijs'}</span>
            <p className="text-xl font-semibold text-slate-100">{formatUsdPrice(priceToShow ?? undefined)}</p>
          </div>
          {!isClosed && <LiveFreshnessBadge updatedAt={priceUpdatedAt} />}
        </div>

        {setup.entry?.entryMissed && (
          <div className="mb-3 flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-400 ring-1 ring-inset ring-amber-500/30">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
            Entry gemist — niet achternagaan.
          </div>
        )}

        <div className="mb-3 border-t border-slate-800 pt-3">
          {!isClosed && setup.changeLog.entryZone !== null && <ChangeWarning label="Instapzone" timestamp={setup.changeLog.entryZone} />}
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-xs text-slate-500">Instapzone</span>
            <span className="text-sm font-medium text-slate-100">{formatEntryZoneValue(setup)}</span>
          </div>
        </div>

        <div className="mb-3 border-t border-slate-800 pt-3">
          {!isClosed && setup.changeLog.invalidation !== null && (
            <ChangeWarning label="Stoploss" timestamp={setup.changeLog.invalidation} />
          )}
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-xs text-slate-500">Stoploss</span>
            <span className="text-sm font-medium text-slate-100">{formatUsdPrice(setup.invalidation.price)}</span>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-3">
          {!isClosed && setup.changeLog.targets !== null && <ChangeWarning label="Targets" timestamp={setup.changeLog.targets} />}
          <p className="mb-2 text-xs text-slate-500">Targets</p>
          <TargetPlanList targets={setup.targets} />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2">
        <StrengthRiskMeter label="Signal strength" level={setup.signalStrength} variant="signal" />
        <StrengthRiskMeter label="Risk" level={setup.risk} variant="risk" />
        <div>
          <p className="text-xs text-slate-500">Verwachte duur</p>
          <p className="mt-1 text-xs font-medium text-slate-300">{setup.expectedDuration}</p>
        </div>
      </div>

      <div className="mt-1">
        <Disclosure label="Waarom dit signaal?">
          <GeneratedWhySection setup={setup} />
        </Disclosure>
        <Disclosure label="Technische details">
          <GeneratedTechnicalDetails setup={setup} />
        </Disclosure>
        <Disclosure label="Bronnen">
          <GeneratedSourcesSection setup={setup} />
        </Disclosure>
        <Disclosure label="Lifecycle geschiedenis">
          <LifecycleHistoryList events={setup.lifecycle} />
        </Disclosure>
      </div>
    </Card>
  );
}
