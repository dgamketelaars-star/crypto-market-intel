import { useBinanceUniverse } from '../../hooks/useBinanceMarket';
import { useAnalysisCalculatedAt } from '../../hooks/useSymbolAnalysis';
import { formatClockTime } from '../../utils/format';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Term } from '../terms/Term';
import { ScannerRow } from './ScannerRow';

function HeaderCell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-3 py-2 text-left text-[11px] font-semibold tracking-wide text-slate-500 uppercase ${className}`}>
      {children}
    </th>
  );
}

export function MarketScannerSection() {
  const universe = useBinanceUniverse();
  const calculatedAt = useAnalysisCalculatedAt();

  return (
    <Card className="p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-slate-400 uppercase">Top 50 Market Scanner</h2>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Badge tone="accent" className="text-[10px]">
            Live
          </Badge>
          <Badge tone="calculated" className="text-[10px]">
            Calculated
          </Badge>
          <span>Calculated bijgewerkt {formatClockTime(calculatedAt)}</span>
        </div>
      </div>
      <p className="mb-4 text-xs text-slate-500">
        Objectieve marktkenmerken per symbool, live berekend uit Binance-data. Geen trading-signaal — de{' '}
        <Term termKey="Attention Level" label="Attention" /> kolom markeert alleen wat objectief afwijkt van normaal.
      </p>

      {universe.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">Marktuniversum wordt geladen…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full min-w-[920px] border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60">
                <HeaderCell>Symbol</HeaderCell>
                <HeaderCell>Prijs</HeaderCell>
                <HeaderCell>24h</HeaderCell>
                <HeaderCell>Trend (1h)</HeaderCell>
                <HeaderCell>Momentum (1h)</HeaderCell>
                <HeaderCell>
                  <Term termKey="Volume" label="Rel. Volume" />
                </HeaderCell>
                <HeaderCell>
                  <Term termKey="Volatility" label="Volatility (1h)" />
                </HeaderCell>
                <HeaderCell>
                  <Term termKey="Open Interest" label="OI Δ4h" />
                </HeaderCell>
                <HeaderCell>
                  <Term termKey="Funding" label="Funding" />
                </HeaderCell>
                <HeaderCell>Structure (1h)</HeaderCell>
                <HeaderCell>Attention</HeaderCell>
              </tr>
            </thead>
            <tbody>
              {universe.map((s) => (
                <ScannerRow key={s.symbol} symbol={s.symbol} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-slate-500">
        Attention level is geen trade-signaal. Het markeert alleen dat een symbool objectief afwijkt van normaal
        gedrag — niet welke kant de prijs op gaat.
      </p>
    </Card>
  );
}
