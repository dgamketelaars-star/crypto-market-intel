import { useSyncExternalStore } from 'react';
import { useGeneratedSetups } from '../hooks/useGeneratedSetups';
import { useSystemBSetups } from './open-source-strategy/useSystemBSetups';
import { useSystemCSetups } from './independent-analysis/useSystemCSetups';
import { useSystemDSetups } from './ichimoku-analysis/useSystemDSetups';
import { useSystemEState } from './ai-meta-analyst/useSystemEStore';
import { marketDataStore } from '../store/marketDataStore';
import { Badge } from '../components/ui/Badge';
import { OPEN_SETUP_STATUSES } from '../setups/engine/types';

interface DirectionalCell {
  direction: 'LONG' | 'SHORT';
  status: string;
}

interface EMetaCell {
  finalDecision: 'LONG' | 'SHORT' | 'WAIT' | 'NO_TRADE';
  confidence: string;
}

interface ComparisonRow {
  symbol: string;
  a: DirectionalCell | null;
  b: DirectionalCell | null;
  c: DirectionalCell | null;
  d: DirectionalCell | null;
  e: EMetaCell | null;
}

function agreementLabel(row: ComparisonRow): { label: string; tone: 'long' | 'short' | 'neutral' | 'amber' } {
  const abcdDirections = [row.a?.direction, row.b?.direction, row.c?.direction, row.d?.direction].filter((d): d is 'LONG' | 'SHORT' => d != null);
  const eDirection = row.e && (row.e.finalDecision === 'LONG' || row.e.finalDecision === 'SHORT') ? row.e.finalDecision : null;
  const directions = eDirection ? [...abcdDirections, eDirection] : abcdDirections;
  if (directions.length < 2) return { label: 'Onvoldoende data', tone: 'neutral' };
  const allSame = directions.every((d) => d === directions[0]);
  if (allSame) return { label: `Overeenstemming (${directions.length})`, tone: directions[0] === 'LONG' ? 'long' : 'short' };
  return { label: 'Verschil van mening', tone: 'amber' };
}

function DecisionCell({ decision }: { decision: DirectionalCell | null }) {
  if (!decision) return <span className="text-slate-600">Geen setup</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge tone={decision.direction === 'LONG' ? 'long' : 'short'}>{decision.direction}</Badge>
      <span className="text-slate-500">{decision.status}</span>
    </span>
  );
}

function MetaDecisionCell({ decision }: { decision: EMetaCell | null }) {
  if (!decision) return <span className="text-slate-600">Geen analyse</span>;
  const tone = decision.finalDecision === 'LONG' ? 'long' : decision.finalDecision === 'SHORT' ? 'short' : decision.finalDecision === 'WAIT' ? 'amber' : 'neutral';
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge tone={tone}>{decision.finalDecision}</Badge>
      <span className="text-slate-500">{decision.confidence}</span>
    </span>
  );
}

/**
 * Pure comparison/join layer — reads all five systems' already-computed
 * outputs and displays them side by side. Deliberately does not combine
 * their conclusions into any kind of consensus score or "who was right"
 * verdict: agreement is shown as a fact, never implied to prove correctness.
 * System E's own opinion is displayed alongside, not folded silently into
 * the A-D read — its whole purpose is to be an independent check on them.
 */
export function ComparisonPanel() {
  const universe = useSyncExternalStore(marketDataStore.subscribe, () => marketDataStore.getState().universe);
  const setupsA = useGeneratedSetups();
  const setupsB = useSystemBSetups();
  const setupsC = useSystemCSetups();
  const setupsD = useSystemDSetups();
  const stateE = useSystemEState();

  const rows: ComparisonRow[] = universe.map(({ symbol }) => {
    const openA = setupsA.find((s) => s.symbol === symbol && OPEN_SETUP_STATUSES.includes(s.status));
    const openB = setupsB.find((s) => s.symbol === symbol && (s.status === 'entry_triggered' || s.status === 'active'));
    const openC = setupsC.find((s) => s.symbol === symbol && (s.status === 'entry_zone_now' || s.status === 'active'));
    const openD = setupsD.find((s) => s.symbol === symbol && (s.status === 'entry_zone_now' || s.status === 'active'));
    const recordE = stateE.records[symbol];

    return {
      symbol,
      a: openA ? { direction: openA.direction, status: openA.status } : null,
      b: openB ? { direction: openB.direction, status: openB.status } : null,
      c: openC ? { direction: openC.direction, status: openC.status } : null,
      d: openD ? { direction: openD.direction, status: openD.status } : null,
      e: recordE ? { finalDecision: recordE.result.finalDecision, confidence: recordE.result.confidence } : null,
    };
  });

  const withAnyOutput = rows.filter((r) => r.a || r.b || r.c || r.d || r.e);

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Elk systeem redeneert onafhankelijk over dezelfde ruwe marktdata. Overeenstemming tussen systemen bewijst geen correctheid — het is puur een
        vergelijking van conclusies. System E's eindbesluit is één extra, onafhankelijke mening — geen jury-uitspraak over wie gelijk heeft.
      </p>
      {withAnyOutput.length === 0 ? (
        <p className="text-sm text-slate-500">Geen van de systemen heeft momenteel een setup of analyse.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">Symbool</th>
                <th className="px-3 py-2 font-medium">Onze analist (A)</th>
                <th className="px-3 py-2 font-medium">Open-source model (B)</th>
                <th className="px-3 py-2 font-medium">Onafhankelijke analyse (C)</th>
                <th className="px-3 py-2 font-medium">Ichimoku (D)</th>
                <th className="px-3 py-2 font-medium">AI Meta Analyst (E)</th>
                <th className="px-3 py-2 font-medium">Vergelijking</th>
              </tr>
            </thead>
            <tbody>
              {withAnyOutput.map((row) => {
                const agreement = agreementLabel(row);
                return (
                  <tr key={row.symbol} className="border-t border-slate-800">
                    <td className="px-3 py-2 font-medium text-slate-200">{row.symbol}</td>
                    <td className="px-3 py-2"><DecisionCell decision={row.a} /></td>
                    <td className="px-3 py-2"><DecisionCell decision={row.b} /></td>
                    <td className="px-3 py-2"><DecisionCell decision={row.c} /></td>
                    <td className="px-3 py-2"><DecisionCell decision={row.d} /></td>
                    <td className="px-3 py-2"><MetaDecisionCell decision={row.e} /></td>
                    <td className="px-3 py-2">
                      <Badge tone={agreement.tone}>{agreement.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
