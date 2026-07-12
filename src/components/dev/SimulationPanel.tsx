import { useSimulation } from '../../hooks/useSimulation';
import { formatUsdPrice } from '../../utils/format';
import { GeneratedSetupCard } from '../setups-generated/GeneratedSetupCard';
import { Card } from '../ui/Card';

export function SimulationPanel() {
  const sim = useSimulation();

  const activeDirections = new Set(sim.setups.filter((s) => s.status === 'active').map((s) => s.direction));
  const priceOverride = sim.price !== null && sim.priceUpdatedAt !== null ? { price: sim.price, updatedAt: sim.priceUpdatedAt } : undefined;

  return (
    <Card className="border-amber-500/30 bg-amber-500/[0.03] p-5">
      <div className="mb-4 flex items-center gap-2 rounded-md bg-amber-500/10 px-3 py-2 ring-1 ring-inset ring-amber-500/30">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
        <p className="text-xs font-semibold tracking-wide text-amber-400 uppercase">
          Simulation mode — not live market data
        </p>
      </div>
      <p className="mb-4 text-xs text-slate-500">
        Draait nog op de oude family-pattern engine (pre-intelligence-pipeline) — losstaand van de live setups hierboven, die nu door de nieuwe evidence-synthese/thesis-engine worden gegenereerd.
      </p>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {sim.scenarios.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              onClick={() => sim.selectScenario(scenario.id)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                sim.scenarioId === scenario.id
                  ? 'bg-amber-500/15 text-amber-400 ring-1 ring-inset ring-amber-500/30'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              {scenario.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => sim.setForceStale((v) => !v)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
              sim.forceStale
                ? 'bg-rose-500/15 text-rose-400 ring-rose-500/30'
                : 'text-slate-400 ring-slate-700 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
            title="Forceert priceIsStale=true op de volgende tick(s) — test dat actieve setups bevriezen i.p.v. stilzwijgend te veranderen."
          >
            {sim.forceStale ? 'Stale data: AAN' : 'Simuleer stale data'}
          </button>
          <button
            type="button"
            onClick={sim.reset}
            className="rounded-md border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={sim.step}
            disabled={!sim.canStep}
            className="rounded-md bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-400 ring-1 ring-inset ring-amber-500/30 hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next tick →
          </button>
        </div>
      </div>

      <p className="mb-2 text-xs text-slate-500">
        {sim.scenarios.find((s) => s.id === sim.scenarioId)?.description} Tick {sim.progress.current}/{sim.progress.total}
        {sim.price !== null && (
          <>
            {' · '}Prijs <span className="font-medium text-slate-300">{formatUsdPrice(sim.price)}</span>
          </>
        )}
      </p>

      {sim.resolution && (
        <p className="mb-4 text-xs text-slate-500">
          Conflict-resolutie: <span className="font-medium text-slate-300">{sim.resolution.outcome}</span> — LONG score{' '}
          {sim.resolution.long.netScore} · SHORT score {sim.resolution.short.netScore}
          {activeDirections.size > 1 && <span className="ml-2 font-semibold text-rose-400">⚠ beide richtingen actief!</span>}
        </p>
      )}

      {sim.setups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-800 p-4 text-center text-sm text-slate-500">
          Klik op "Next tick" om de simulatie te starten.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {sim.setups.map((s) => (
            <GeneratedSetupCard key={s.id} setup={s} priceOverride={priceOverride} />
          ))}
        </div>
      )}
    </Card>
  );
}
