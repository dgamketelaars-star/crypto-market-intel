import { useState, useSyncExternalStore } from 'react';
import { useSystemEState } from '../useSystemEStore';
import { systemEStore } from '../store/systemEStore';
import { systemEApiKeyStore } from '../settings/apiKeyStore';
import { SYSTEM_E_PROVENANCE } from '../metadata/provenance';
import { SystemESettings } from './SystemESettings';
import { marketDataStore } from '../../../store/marketDataStore';
import { Badge, type BadgeTone } from '../../../components/ui/Badge';
import { formatChangeTimestamp } from '../../../utils/format';
import type { SystemEFinalDecision } from '../prompt/outputSchema';

const DECISION_TONE: Record<SystemEFinalDecision, BadgeTone> = {
  LONG: 'long',
  SHORT: 'short',
  WAIT: 'amber',
  NO_TRADE: 'neutral',
};

function ManualTrigger() {
  const universe = useSyncExternalStore(marketDataStore.subscribe, () => marketDataStore.getState().universe);
  const [symbol, setSymbol] = useState('');
  const [running, setRunning] = useState(false);
  const hasKey = systemEApiKeyStore.hasApiKey();

  const trigger = async () => {
    if (!symbol) return;
    setRunning(true);
    try {
      await systemEStore.analyzeSymbolNow(symbol);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200">
        <option value="">Kies symbool…</option>
        {universe.map((s) => (
          <option key={s.symbol} value={s.symbol}>
            {s.symbol}
          </option>
        ))}
      </select>
      <button
        onClick={trigger}
        disabled={!hasKey || !symbol || running}
        className="rounded bg-sky-600 px-3 py-1 font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {running ? 'Analyseren…' : 'Analyseer nu'}
      </button>
    </div>
  );
}

function AnalysisCard({ record }: { record: ReturnType<typeof useSystemEState>['records'][string] }) {
  const { result } = record;
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-100">{record.symbol}</span>
        <Badge tone={DECISION_TONE[result.finalDecision]}>{result.finalDecision}</Badge>
        <Badge tone={result.confidence === 'high' ? 'calculated' : 'neutral'}>Confidence: {result.confidence}</Badge>
        <Badge tone={result.followsConsensus === 'diverges' ? 'orange' : 'accent'}>
          {result.followsConsensus === 'follows' ? 'Volgt consensus' : result.followsConsensus === 'diverges' ? 'Wijkt af' : 'Volgt deels'}
        </Badge>
        <span className="ml-auto text-xs text-slate-600">{formatChangeTimestamp(record.generatedAt)}</span>
      </div>

      <div className="space-y-3 text-xs text-slate-400">
        <section>
          <h4 className="mb-1 font-semibold text-slate-300">1. Consensus van A-D</h4>
          <p>{result.consensusSummary}</p>
          {result.consensusAgreements.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {result.consensusAgreements.map((a, i) => (
                <li key={i}>✓ {a}</li>
              ))}
            </ul>
          )}
          {result.consensusDisagreements.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-amber-500/80">
              {result.consensusDisagreements.map((d, i) => (
                <li key={i}>≠ {d}</li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h4 className="mb-1 font-semibold text-slate-300">2. Eigen analyse</h4>
          <p>{result.independentAnalysis}</p>
          <p className="mt-1 text-slate-300">
            <span className="font-medium">Trade-locatie:</span> {result.tradeLocationAssessment}
          </p>
        </section>

        {result.sharedBlindSpotWarning && (
          <section className="rounded border border-orange-500/30 bg-orange-500/5 p-2">
            <h4 className="mb-1 font-semibold text-orange-400">⚠ Mogelijke gedeelde denkfout</h4>
            <p>{result.sharedBlindSpotWarning}</p>
          </section>
        )}

        <section>
          <h4 className="mb-1 font-semibold text-slate-300">3. Vergelijking</h4>
          <p>{result.comparison}</p>
        </section>

        <section>
          <h4 className="mb-1 font-semibold text-slate-300">4. Eindbesluit</h4>
          <p>
            <span className="font-medium text-slate-200">{result.finalDecision}</span> — confidence {result.confidence}: {result.confidenceReasoning}
          </p>
        </section>

        <section>
          <h4 className="mb-1 font-semibold text-slate-300">5. Motivatie</h4>
          <p>{result.motivation}</p>
          {result.riskFactors.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-rose-400/80">
              {result.riskFactors.map((r, i) => (
                <li key={i}>⚠ {r}</li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function LogPanel({ log }: { log: ReturnType<typeof useSystemEState>['log'] }) {
  const recent = [...log].reverse().slice(0, 20);
  const totalCost = log.reduce((sum, e) => sum + (e.estimatedCostUsd ?? 0), 0);
  if (recent.length === 0) return null;
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-400">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold text-slate-300">Log (eigen logging — transparantie over kosten)</h3>
        <span className="text-slate-500">Geschatte totale kosten deze sessie: ${totalCost.toFixed(4)}</span>
      </div>
      <div className="max-h-48 space-y-1 overflow-y-auto">
        {recent.map((entry) => (
          <div key={entry.id} className="flex flex-wrap items-center gap-2 border-t border-slate-800 pt-1 first:border-t-0 first:pt-0">
            <span className="text-slate-500">{formatChangeTimestamp(entry.timestamp)}</span>
            <span className="text-slate-300">{entry.symbol}</span>
            {entry.success ? (
              <>
                <Badge tone="accent">ok</Badge>
                <span>
                  {entry.inputTokens} in / {entry.outputTokens} out
                </span>
                <span className="text-slate-500">${entry.estimatedCostUsd?.toFixed(4)}</span>
              </>
            ) : (
              <>
                <Badge tone="orange">fout</Badge>
                <span className="text-rose-400">{entry.errorMessage}</span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SystemEPanel() {
  const state = useSystemEState();
  const [, forceRerender] = useState(0);
  const records = Object.values(state.records).sort((a, b) => b.generatedAt - a.generatedAt);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-400">
        <div className="mb-1 text-sm font-semibold text-slate-200">{SYSTEM_E_PROVENANCE.displayName}</div>
        <p className="text-slate-500">{SYSTEM_E_PROVENANCE.nature}</p>
        <p className="mt-1 text-slate-500">{SYSTEM_E_PROVENANCE.scopeDisclaimer}</p>
      </div>

      <SystemESettings onSaved={() => forceRerender((n) => n + 1)} />
      <ManualTrigger />
      <LogPanel log={state.log} />

      {records.length === 0 ? (
        <p className="text-sm text-slate-500">Nog geen analyses. System E draait automatisch elke 20 minuten op symbolen met sterke consensus of onenigheid tussen A-D, of gebruik de handmatige trigger hierboven.</p>
      ) : (
        <div className="space-y-4">
          {records.map((record) => (
            <AnalysisCard key={record.id} record={record} />
          ))}
        </div>
      )}
    </div>
  );
}
