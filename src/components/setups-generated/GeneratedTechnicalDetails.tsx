import type { GeneratedSetup, SetupLevel } from '../../setups/engine/types';
import { formatClockTime, formatUsdPrice } from '../../utils/format';

function LevelRow({ label, level }: { label: string; level: SetupLevel }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-slate-400">{label}</span>
        <span className="text-sm font-semibold text-slate-100">{formatUsdPrice(level.price)}</span>
      </div>
      <p className="text-xs text-slate-500">
        {level.method} ({level.timeframe})
      </p>
      <p className="mt-1 text-xs text-slate-400">{level.explanation}</p>
    </div>
  );
}

/** The raw trigger/invalidation levels, the entry registration, and how each target was calculated — signal strength/risk/duration live on the primary card now, not here. */
export function GeneratedTechnicalDetails({ setup }: { setup: GeneratedSetup }) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <LevelRow label="Trigger" level={setup.trigger} />
        <LevelRow label="Invalidation" level={setup.invalidation} />
      </div>

      {setup.entry && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-slate-400">Entry-registratie</p>
          <div className="space-y-1 rounded-md border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-400">
            <p>
              Trigger-niveau <span className="font-medium text-slate-200">{formatUsdPrice(setup.entry.triggerPrice)}</span> geactiveerd
              om {formatClockTime(setup.entry.activatedAt)}.
            </p>
            <p>
              Eerste geldige live prijs na bevestiging:{' '}
              <span className="font-medium text-slate-200">{formatUsdPrice(setup.entry.firstLivePrice)}</span>
              {setup.entry.entryMissed ? ' — dit was al buiten de toegestane entry-afstand (ATR-gebaseerd), dus "entry missed".' : '.'}
            </p>
            <p>
              Best bereikte prijs sinds entry: {formatUsdPrice(setup.entry.highestFavorableExcursion)} · Slechtste prijs sinds entry:{' '}
              {formatUsdPrice(setup.entry.largestAdverseExcursion)}.
            </p>
          </div>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-xs font-semibold text-slate-400">Target-berekening (voorbeeld-positieplan)</p>
        {setup.targets.length === 0 ? (
          <p className="text-xs text-slate-500">
            Geen koersdoel getoond — er is (nog) geen niveau dat aan de minimale reward:risk-eis voldoet.
          </p>
        ) : (
          <div className="space-y-2">
            {setup.targets.map((target) => (
              <div key={target.order} className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="text-xs font-medium text-slate-400">
                    Target {target.order}
                    {target.isFinal ? ' (final)' : ''} · {target.positionPortionPct}% van plan
                  </span>
                  <span className="text-sm font-semibold text-slate-100">{formatUsdPrice(target.price)}</span>
                </div>
                <p className="text-xs text-slate-500">
                  {target.method} ({target.timeframe})
                  {target.rewardToRisk !== null ? ` · R:R ${target.rewardToRisk.toFixed(2)}` : ''}
                </p>
                <p className="mt-1 text-xs text-slate-400">{target.explanation}</p>
              </div>
            ))}
            <p className="text-xs text-slate-500">
              De positieportie per target is een voorbeeld-positieplan (niet hardcoded per setup) op basis van het aantal
              verdedigbare targets en de 1H-volatiliteit — het totaal komt altijd uit op 100%.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
