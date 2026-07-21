import { useState, useSyncExternalStore } from 'react';
import { useSystemEState } from '../useSystemEStore';
import { systemEStore } from '../store/systemEStore';
import { systemEApiKeyStore } from '../settings/apiKeyStore';
import { SYSTEM_E_PROVENANCE } from '../metadata/provenance';
import { SystemESettings } from './SystemESettings';
import { marketDataStore } from '../../../store/marketDataStore';
import { Badge, type BadgeTone } from '../../../components/ui/Badge';
import { formatChangeTimestamp } from '../../../utils/format';
import type { SystemEDecision } from '../prompt/phase1Schema';
import type { SetupQuality } from '../prompt/setupQuality';
import { decisionChangedAfterReadingAD, type SystemERecord } from '../records/systemERecord';

const DECISION_TONE: Record<SystemEDecision, BadgeTone> = {
  LONG: 'long',
  SHORT: 'short',
  WAIT: 'amber',
  NO_TRADE: 'neutral',
};

const SETUP_QUALITY_TONE: Record<SetupQuality, BadgeTone> = {
  'A+': 'calculated',
  A: 'calculated',
  B: 'accent',
  C: 'amber',
  D: 'neutral',
};

const SELECTION_REASON_LABEL: Record<string, string> = {
  strong_consensus: 'sterke overeenstemming A-D',
  disagreement: 'onenigheid A-D',
  confidence_divergence: 'verschil in confidence A-D',
  level_divergence: 'verschil in entry/stop/targets A-D',
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
        <option value="">Kies symbool (volledige top-50)…</option>
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
        {running ? 'Analyseren (2 stappen)…' : 'Analyseer nu'}
      </button>
    </div>
  );
}

function ZoneAndLevels({ zone, invalidation, targets, riskReward }: { zone: { low: number; high: number } | null; invalidation: number | null; targets: Array<{ price: number; reason: string }>; riskReward: number | null }) {
  if (!zone && invalidation == null && targets.length === 0) return null;
  return (
    <ul className="mt-1 space-y-0.5">
      {zone && <li>Entryzone: {zone.low} – {zone.high}</li>}
      {invalidation != null && <li>Invalidatie: {invalidation}</li>}
      {targets.length > 0 && <li>Targets: {targets.map((t) => `${t.price} (${t.reason})`).join(', ')}</li>}
      {riskReward != null && <li>Risk/reward: {riskReward.toFixed(2)}</li>}
    </ul>
  );
}

function AnalysisCard({ record }: { record: SystemERecord }) {
  const { phase1, phase2 } = record;
  const changed = decisionChangedAfterReadingAD(record);
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-100">{record.symbol}</span>
        <Badge tone={DECISION_TONE[phase2.finalDecision]}>{phase2.finalDecision}</Badge>
        <Badge tone={SETUP_QUALITY_TONE[phase2.finalSetupQuality]}>Setupkwaliteit: {phase2.finalSetupQuality}</Badge>
        <Badge tone={phase2.finalConfidence === 'high' ? 'calculated' : 'neutral'}>Confidence: {phase2.finalConfidence}</Badge>
        <Badge tone={changed ? 'orange' : 'accent'}>{changed ? 'Bijgesteld na A-D' : 'Behouden na A-D'}</Badge>
        <span className="text-slate-600">
          {record.triggerType === 'manual' ? 'handmatig' : `automatisch — ${SELECTION_REASON_LABEL[record.selectionReason ?? ''] ?? record.selectionReason}`}
        </span>
        <span className="ml-auto text-xs text-slate-600">{formatChangeTimestamp(record.generatedAt)}</span>
      </div>

      <div className="space-y-3 text-xs text-slate-400">
        <section>
          <div className="mb-1 flex items-center gap-2">
            <h4 className="font-semibold text-slate-300">1. Onafhankelijke analyse (vóór A-D)</h4>
            <Badge tone={DECISION_TONE[phase1.decision]}>{phase1.decision}</Badge>
            <Badge tone={SETUP_QUALITY_TONE[phase1.setupQuality]}>Setupkwaliteit: {phase1.setupQuality}</Badge>
          </div>
          <p>Marktregime: {phase1.marketRegime}</p>
          <p>Richting hogere timeframe: {phase1.higherTimeframeDirection}</p>
          <p>Structuur: {phase1.shortTermStructure} — Momentum: {phase1.momentum}</p>
          <p className="mt-1 text-slate-300">
            <span className="font-medium">Trade-locatie:</span> {phase1.tradeLocationAssessment}
          </p>
          {(phase1.supportLevels.length > 0 || phase1.resistanceLevels.length > 0) && (
            <p>
              {phase1.supportLevels.length > 0 && <>Support: {phase1.supportLevels.join(', ')} </>}
              {phase1.resistanceLevels.length > 0 && <>Resistance: {phase1.resistanceLevels.join(', ')}</>}
            </p>
          )}
          <ZoneAndLevels zone={phase1.entryZone} invalidation={phase1.invalidation} targets={phase1.targets} riskReward={phase1.riskRewardRatio} />
          {phase1.argumentsFor.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {phase1.argumentsFor.map((a, i) => (
                <li key={i}>✓ {a}</li>
              ))}
            </ul>
          )}
          {phase1.argumentsAgainst.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-amber-500/80">
              {phase1.argumentsAgainst.map((a, i) => (
                <li key={i}>⚠ {a}</li>
              ))}
            </ul>
          )}
          {phase1.waitConditions.length > 0 && (
            <p className="mt-1 text-slate-300">
              <span className="font-medium">Wacht op:</span> {phase1.waitConditions.join('; ')}
            </p>
          )}
        </section>

        <section>
          <h4 className="mb-1 font-semibold text-slate-300">2. Analyse van A-D (gepubliceerde output)</h4>
          <p>{phase2.adSummary}</p>
          {phase2.adAgreements.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {phase2.adAgreements.map((a, i) => (
                <li key={i}>✓ {a}</li>
              ))}
            </ul>
          )}
          {phase2.adDisagreements.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-amber-500/80">
              {phase2.adDisagreements.map((d, i) => (
                <li key={i}>≠ {d}</li>
              ))}
            </ul>
          )}
          {phase2.adMissingSystems.length > 0 && <p className="mt-1">Geen actieve setup: {phase2.adMissingSystems.join(', ')}</p>}
          {phase2.adLevelDifferences.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {phase2.adLevelDifferences.map((d, i) => (
                <li key={i}>↔ {d}</li>
              ))}
            </ul>
          )}
        </section>

        {phase2.sharedBlindSpotWarning && (
          <section className="rounded border border-orange-500/30 bg-orange-500/5 p-2">
            <h4 className="mb-1 font-semibold text-orange-400">⚠ Mogelijke gedeelde denkfout</h4>
            <p>{phase2.sharedBlindSpotWarning}</p>
          </section>
        )}

        <section>
          <h4 className="mb-1 font-semibold text-slate-300">3. Vergelijking</h4>
          <p>{phase2.comparisonToPhase1}</p>
        </section>

        <section>
          <h4 className="mb-1 font-semibold text-slate-300">4. Eindbesluit</h4>
          <p>
            <span className="font-medium text-slate-200">{phase2.finalDecision}</span> — setupkwaliteit {phase2.finalSetupQuality}, confidence {phase2.finalConfidence}
          </p>
          <ZoneAndLevels zone={phase2.finalEntryZone} invalidation={phase2.finalInvalidation} targets={phase2.finalTargets} riskReward={phase2.finalRiskRewardRatio} />
        </section>

        <section>
          <h4 className="mb-1 font-semibold text-slate-300">5. Motivatie</h4>
          <p>{phase2.motivation}</p>
          <p className="mt-1">
            <span className="font-medium text-slate-300">Edge:</span> {phase2.edgeSummary}
          </p>
          <p>
            <span className="font-medium text-slate-300">Belangrijkste risico:</span> {phase2.keyRisk}
          </p>
          <p>
            <span className="font-medium text-slate-300">Ongeldig als:</span> {phase2.invalidationCondition}
          </p>
          {phase2.waitConditions.length > 0 && (
            <p className="mt-1 text-slate-300">
              <span className="font-medium">Wacht op:</span> {phase2.waitConditions.join('; ')}
            </p>
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
      <div className="max-h-56 space-y-1 overflow-y-auto">
        {recent.map((entry) => (
          <div key={entry.id} className="flex flex-wrap items-center gap-2 border-t border-slate-800 pt-1 first:border-t-0 first:pt-0">
            <span className="text-slate-500">{formatChangeTimestamp(entry.timestamp)}</span>
            <span className="text-slate-300">{entry.symbol}</span>
            <span className="text-slate-600">{entry.triggerType === 'manual' ? 'handmatig' : 'automatisch'}</span>
            {entry.success ? (
              <>
                <Badge tone="accent">ok</Badge>
                {entry.initialDecision && entry.finalDecision && (
                  <span>
                    {entry.initialDecision}→{entry.finalDecision} ({entry.initialSetupQuality}→{entry.finalSetupQuality}) {entry.decisionChangedAfterAD ? '⚠ gewijzigd' : ''}
                  </span>
                )}
                <span>
                  {entry.inputTokens} in / {entry.outputTokens} out
                </span>
                <span className="text-slate-500">${entry.estimatedCostUsd?.toFixed(4)}</span>
              </>
            ) : (
              <>
                <Badge tone="orange">fout ({entry.errorPhase})</Badge>
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
        <p className="text-sm text-slate-500">
          Nog geen analyses. System E draait automatisch elke 20 minuten op symbolen uit de gedeelde top-50 waar A-D voldoende interessant zijn (sterke
          overeenstemming, onenigheid, of een opvallend verschil in confidence/niveaus), of gebruik de handmatige trigger hierboven voor elk symbool.
        </p>
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
