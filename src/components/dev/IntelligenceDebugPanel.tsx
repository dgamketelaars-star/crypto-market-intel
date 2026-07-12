import { useState, useSyncExternalStore } from 'react';
import { useIntelligenceEvidence } from '../../hooks/useIntelligenceEvidence';
import type { CategoryEvidence, LayerACategoryEvidence } from '../../intelligence/evidence/types';
import { marketDataStore } from '../../store/marketDataStore';
import { Badge, type BadgeTone } from '../ui/Badge';
import { Card } from '../ui/Card';

const CONCLUSION_TONE: Record<string, BadgeTone> = {
  bullish: 'long',
  slightly_bullish: 'long',
  bearish: 'short',
  slightly_bearish: 'short',
  neutral: 'neutral',
  conflicted: 'orange',
  insufficient_data: 'amber',
};

function FactList({ label, facts }: { label: string; facts: { description: string }[] }) {
  if (facts.length === 0) return null;
  return (
    <div className="mt-1">
      <span className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">{label}</span>
      <ul className="mt-0.5 list-inside list-disc space-y-0.5">
        {facts.map((f, i) => (
          <li key={i} className="text-xs text-slate-400">
            {f.description}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CategoryRow({ title, evidence }: { title: string; evidence: CategoryEvidence }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-200">{title}</span>
        <Badge tone={CONCLUSION_TONE[evidence.conclusion] ?? 'neutral'}>{evidence.conclusion}</Badge>
        {evidence.timeframe && <span className="text-[10px] text-slate-600 uppercase">{evidence.timeframe}</span>}
      </div>
      <FactList label="Supporting" facts={evidence.supporting} />
      <FactList label="Opposing" facts={evidence.opposing} />
      {evidence.missingData.length > 0 && (
        <div className="mt-1">
          <span className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">Missing data</span>
          <ul className="mt-0.5 list-inside list-disc space-y-0.5">
            {evidence.missingData.map((m, i) => (
              <li key={i} className="text-xs text-slate-500 italic">
                {m}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function GateRow({ title, gate }: { title: string; gate: LayerACategoryEvidence }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-200">{title}</span>
        <Badge tone={gate.gateStatus === 'blocked' ? 'short' : 'accent'}>{gate.gateStatus}</Badge>
        <Badge tone={CONCLUSION_TONE[gate.bias] ?? 'neutral'}>bias: {gate.bias}</Badge>
      </div>
      {gate.blockedReason && <p className="mt-1 text-xs text-rose-400">{gate.blockedReason}</p>}
      <FactList label="Supporting" facts={gate.supporting} />
    </div>
  );
}

/**
 * Phase 2+3+4 debug view: the full evidence picture, decision-flow outcome
 * and (if valid) trade plan the intelligence layer builds for one symbol —
 * every conclusion traceable to its supporting/opposing facts. Nothing here
 * is published as a setup yet (see src/intelligence/generationStatus.ts):
 * the thesis and trade plan shown below are purely informational, computed
 * here for inspection only. Phase 5 still needs to wire this into setup
 * creation and lifecycle before anything reaches the normal UI.
 */
export function IntelligenceDebugPanel() {
  const universe = useSyncExternalStore(marketDataStore.subscribe, () => marketDataStore.getState().universe);
  const [symbol, setSymbol] = useState('BTCUSDT');
  const pipeline = useIntelligenceEvidence(symbol);
  const result = pipeline?.synthesis ?? null;
  const thesis = pipeline?.thesis ?? null;
  const plan = pipeline?.plan ?? null;

  return (
    <Card className="border-sky-500/30 bg-sky-500/[0.03] p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-md bg-sky-500/10 px-3 py-2 ring-1 ring-inset ring-sky-500/30">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
          <p className="text-xs font-semibold tracking-wide text-sky-400 uppercase">
            Intelligence evidence + thesis (Fase 2+3) — niet gekoppeld aan setup-publicatie
          </p>
        </div>
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
        >
          {universe.length === 0 ? (
            <option value={symbol}>{symbol}</option>
          ) : (
            universe.map((s) => (
              <option key={s.symbol} value={s.symbol}>
                {s.symbol}
              </option>
            ))
          )}
        </select>
      </div>

      {!result ? (
        <p className="rounded-lg border border-dashed border-slate-800 p-4 text-center text-xs text-slate-500">
          Wachten op live marktdata en analyse voor {symbol}...
        </p>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-800 bg-slate-950/40 p-3">
            <span className="text-xs font-semibold text-slate-200">Regime: {result.regime.regime}</span>
            <Badge tone={CONCLUSION_TONE[result.regime.bias] ?? 'neutral'}>{result.regime.bias}</Badge>
            <span className="text-xs text-slate-500">·</span>
            <span className="text-xs font-semibold text-slate-200">Provisional bias: {result.provisionalBias}</span>
            {result.layerAConflicted && <Badge tone="orange">Layer A conflicted</Badge>}
          </div>

          {thesis && (
            <div className={`rounded-md border p-3 ${thesis.outcome === 'NO_THESIS' ? 'border-amber-500/30 bg-amber-500/[0.03]' : 'border-emerald-500/30 bg-emerald-500/[0.03]'}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-200">Decision flow outcome:</span>
                <Badge tone={thesis.outcome === 'NO_THESIS' ? 'amber' : thesis.direction === 'LONG' ? 'long' : 'short'}>{thesis.outcome}</Badge>
                {thesis.outcome !== 'NO_THESIS' && <Badge tone="calculated">Signal strength: {thesis.signalStrength}</Badge>}
              </div>
              {thesis.outcome === 'NO_THESIS' ? (
                <p className="mt-1 text-xs text-slate-400">
                  <span className="text-slate-500">[{thesis.reason}]</span> {thesis.detail}
                </p>
              ) : (
                <>
                  <p className="mt-1 text-xs text-slate-400">{thesis.narrative}</p>
                  {thesis.contextAdjustments.length > 0 && (
                    <ul className="mt-1 list-inside list-disc space-y-0.5">
                      {thesis.contextAdjustments.map((a, i) => (
                        <li key={i} className="text-xs text-slate-500">
                          {a}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}

          {plan && (
            <div className={`rounded-md border p-3 ${plan.outcome === 'NO_PLAN' ? 'border-amber-500/30 bg-amber-500/[0.03]' : 'border-violet-500/30 bg-violet-500/[0.03]'}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-200">Trade plan (Fase 4):</span>
                <Badge tone={plan.outcome === 'NO_PLAN' ? 'amber' : 'calculated'}>{plan.outcome}</Badge>
                {plan.outcome === 'VALID_PLAN' && <Badge tone="accent">{plan.horizon}</Badge>}
                {plan.outcome === 'VALID_PLAN' && <Badge tone={plan.risk === 'Low' || plan.risk === 'Medium' ? 'neutral' : 'orange'}>Risk: {plan.risk}</Badge>}
              </div>
              {plan.outcome === 'NO_PLAN' ? (
                <p className="mt-1 text-xs text-slate-400">
                  <span className="text-slate-500">[{plan.reason}]</span> {plan.detail}
                </p>
              ) : (
                <div className="mt-1 space-y-1 text-xs text-slate-400">
                  <p>
                    Entry zone: {plan.entryZone.low.toFixed(4)} – {plan.entryZone.high.toFixed(4)} (trigger {plan.trigger.price.toFixed(4)}, {plan.trigger.method})
                  </p>
                  <p>Invalidation: {plan.invalidation.price.toFixed(4)} — {plan.invalidation.explanation}</p>
                  <ul className="list-inside list-disc space-y-0.5">
                    {plan.targets.map((t, i) => (
                      <li key={i}>
                        Target {t.order} ({t.positionPortionPct}%{t.isFinal ? ', final' : ''}): {t.price.toFixed(4)} — R:R {t.rewardToRisk?.toFixed(2) ?? 'n/a'}
                      </li>
                    ))}
                  </ul>
                  {plan.riskFactors.length > 0 && (
                    <ul className="list-inside list-disc space-y-0.5">
                      {plan.riskFactors.map((f, i) => (
                        <li key={i} className="text-slate-500">
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <p className="mb-2 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">Layer A — mandatory thesis foundation</p>
            <div className="space-y-2">
              <GateRow title="Market regime" gate={result.layers.layerA.marketRegime} />
              <GateRow title="Higher-timeframe structure" gate={result.layers.layerA.higherTimeframeStructure} />
              <GateRow title="Entry location (LONG)" gate={result.layers.layerA.entryLocationQuality.LONG} />
              <GateRow title="Entry location (SHORT)" gate={result.layers.layerA.entryLocationQuality.SHORT} />
            </div>
          </div>

          <div>
            <p className="mb-2 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">Layer B — directional confirmation</p>
            <div className="space-y-2">
              <CategoryRow title="Trend" evidence={result.layers.layerB.trend} />
              <CategoryRow title="Momentum" evidence={result.layers.layerB.momentum} />
              <CategoryRow title="Volume" evidence={result.layers.layerB.volume} />
            </div>
          </div>

          <div>
            <p className="mb-2 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">Layer C — context, risk and veto filters</p>
            <div className="space-y-2">
              <CategoryRow title="Volatility" evidence={result.layers.layerC.volatility} />
              <CategoryRow title="Derivatives positioning" evidence={result.layers.layerC.derivativesPositioning} />
              <CategoryRow title="BTC/ETH context" evidence={result.layers.layerC.btcEthContext} />
              <CategoryRow title="Risk / conflict" evidence={result.layers.layerC.riskConflict} />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
