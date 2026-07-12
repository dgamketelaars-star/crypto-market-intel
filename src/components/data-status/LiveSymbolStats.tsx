import { useBinanceMarket } from '../../hooks/useBinanceMarket';
import { useIsStale } from '../../hooks/useIsStale';
import { Term } from '../terms/Term';
import {
  formatClockTime,
  formatCompactNumber,
  formatCompactUsd,
  formatFundingRate,
  formatPercent,
  formatUsdPrice,
} from '../../utils/format';

export type LiveField = 'price' | 'change' | 'funding' | 'openInterest' | 'volume';

interface LiveSymbolStatsProps {
  symbol: string;
  title?: string;
  fields?: LiveField[];
  showLastUpdate?: boolean;
}

const DEFAULT_FIELDS: LiveField[] = ['price', 'change', 'funding', 'openInterest'];

export function LiveSymbolStats({ symbol, title, fields = DEFAULT_FIELDS, showLastUpdate = true }: LiveSymbolStatsProps) {
  const data = useBinanceMarket(symbol);
  const stale = useIsStale(data?.updatedAt);
  const hasData = Boolean(data?.ticker || data?.markPrice);

  const price = data?.ticker?.lastPrice ?? data?.markPrice?.markPrice;
  const change = data?.ticker?.priceChangePercent;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-300">{title ?? symbol}</span>
        <span
          className={`flex items-center gap-1 text-[10px] font-medium tracking-wide uppercase ${
            !hasData ? 'text-slate-500' : stale ? 'text-amber-400' : 'text-emerald-400'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${!hasData ? 'bg-slate-600' : stale ? 'bg-amber-400' : 'bg-emerald-400'}`}
          />
          {!hasData ? 'Laden…' : stale ? 'Verouderd' : 'Live'}
        </span>
      </div>

      {!hasData ? (
        <p className="text-xs text-slate-500">Wachten op marktdata voor {symbol}…</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
            {fields.includes('price') && (
              <div>
                <dt className="text-[11px] text-slate-500">Prijs</dt>
                <dd className="text-sm font-medium text-slate-100">{formatUsdPrice(price)}</dd>
              </div>
            )}
            {fields.includes('change') && (
              <div>
                <dt className="text-[11px] text-slate-500">24h</dt>
                <dd
                  className={`text-sm font-medium ${
                    (change ?? 0) > 0 ? 'text-emerald-400' : (change ?? 0) < 0 ? 'text-rose-400' : 'text-slate-300'
                  }`}
                >
                  {formatPercent(change)}
                </dd>
              </div>
            )}
            {fields.includes('funding') && (
              <div>
                <dt className="text-[11px] text-slate-500">
                  <Term termKey="Funding" />
                </dt>
                <dd className="text-sm font-medium text-slate-100">{formatFundingRate(data?.funding?.fundingRate)}</dd>
              </div>
            )}
            {fields.includes('openInterest') && (
              <div>
                <dt className="text-[11px] text-slate-500">
                  <Term termKey="Open Interest" />
                </dt>
                <dd className="text-sm font-medium text-slate-100">
                  {formatCompactNumber(data?.openInterest?.openInterest)}
                </dd>
              </div>
            )}
            {fields.includes('volume') && (
              <div>
                <dt className="text-[11px] text-slate-500">24h Volume</dt>
                <dd className="text-sm font-medium text-slate-100">{formatCompactUsd(data?.ticker?.quoteVolume)}</dd>
              </div>
            )}
          </dl>
          {showLastUpdate && (
            <p className="mt-2 text-[11px] text-slate-500">Last update {formatClockTime(data?.updatedAt)}</p>
          )}
        </>
      )}
    </div>
  );
}
