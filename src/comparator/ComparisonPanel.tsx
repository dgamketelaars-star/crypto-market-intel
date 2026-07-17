import { useSyncExternalStore } from 'react';
import { useGeneratedSetups } from '../hooks/useGeneratedSetups';
import { useSystemBSetups } from './open-source-strategy/useSystemBSetups';
import { useSystemCSetups } from './independent-analysis/useSystemCSetups';
import { marketDataStore } from '../store/marketDataStore';
import { Badge } from '../components/ui/Badge';
import { OPEN_SETUP_STATUSES } from '../setups/engine/types';

interface ComparisonRow {
  symbol: string;
  a: { direction: 'LONG' | 'SHORT'; status: string } | null;
  b: { direction: 'LONG' | 'SHORT'; status: string } | null;
  c: { direction: 'LONG' | 'SHORT'; status: string } | null;
}

function agreementLabel(row: ComparisonRow): { label: string; tone: 'long' | 'short' | 'neutral' | 'amber' } {
  const directions = [row.a?.direction, row.b?.direction, row.c?.direction].filter((d): d is 'LONG' | 'SHORT' => d != null);
  if (directions.length < 2) return { label: 'Onvoldoende data', tone: 'neutral' };
  const allSame = directions.every((d) => d === directions[0]);
  return allSame ? { label: 'Overeenstemming', tone: directions[0] === 'LONG' ? 'long' : 'short' } : { label: 'Verschil van mening', tone: 'amber' };
}

function DecisionCell({ decision }: { decision: ComparisonRow['a'] }) {
  if (!decision) return <span className="text-slate-600">Geen setup</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge tone={decision.direction === 'LONG' ? 'long' : 'short'}>{decision.direction}</Badge>
      <span className="text-slate-500">{decision.status}</span>
    </span>
  );
}

/**
 * Pure comparison/join layer — reads the three systems' already-computed
 * outputs and displays them side by side. Deliberately does not combine
 * their conclusions into any kind of consensus score or "who was right"
 * verdict: agreement is shown as a fact, never implied to prove correctness.
 */
export function ComparisonPanel() {
  const universe = useSyncExternalStore(marketDataStore.subscribe, () => marketDataStore.getState().universe);
  const setupsA = useGeneratedSetups();
  const setupsB = useSystemBSetups();
  const setupsC = useSystemCSetups();

  const rows: ComparisonRow[] = universe.map(({ symbol }) => {
    const openA = setupsA.find((s) => s.symbol === symbol && OPEN_SETUP_STATUSES.includes(s.status));
    const openB = setupsB.find((s) => s.symbol === symbol && (s.status === 'entry_triggered' || s.status === 'active'));
    const openC = setupsC.find((s) => s.symbol === symbol && (s.status === 'entry_zone_now' || s.status === 'active'));

    return {
      symbol,
      a: openA ? { direction: openA.direction, status: openA.status } : null,
      b: openB ? { direction: openB.direction, status: openB.status } : null,
      c: openC ? { direction: openC.direction, status: openC.status } : null,
    };
  });

  const withAnySetup = rows.filter((r) => r.a || r.b || r.c);

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Elk systeem redeneert onafhankelijk over dezelfde ruwe marktdata. Overeenstemming tussen systemen bewijst geen correctheid — het is puur een
        vergelijking van conclusies.
      </p>
      {withAnySetup.length === 0 ? (
        <p className="text-sm text-slate-500">Geen van de drie systemen heeft momenteel een open setup.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">Symbool</th>
                <th className="px-3 py-2 font-medium">Onze analist (A)</th>
                <th className="px-3 py-2 font-medium">Open-source model (B)</th>
                <th className="px-3 py-2 font-medium">Onafhankelijke analyse (C)</th>
                <th className="px-3 py-2 font-medium">Vergelijking</th>
              </tr>
            </thead>
            <tbody>
              {withAnySetup.map((row) => {
                const agreement = agreementLabel(row);
                return (
                  <tr key={row.symbol} className="border-t border-slate-800">
                    <td className="px-3 py-2 font-medium text-slate-200">{row.symbol}</td>
                    <td className="px-3 py-2"><DecisionCell decision={row.a} /></td>
                    <td className="px-3 py-2"><DecisionCell decision={row.b} /></td>
                    <td className="px-3 py-2"><DecisionCell decision={row.c} /></td>
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
