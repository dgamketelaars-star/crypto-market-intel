import { useBinanceMarket } from '../../hooks/useBinanceMarket';
import { useSymbolAnalysis } from '../../hooks/useSymbolAnalysis';
import { formatFundingRate, formatPercent, formatUsdPrice } from '../../utils/format';
import {
  fundingStateLabels,
  momentumLabels,
  structureLabels,
  trendLabels,
  volatilityLabels,
} from '../../analysis/explanations/classificationLabels';
import { AttentionBadge } from './AttentionBadge';

function Cell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 text-sm whitespace-nowrap text-slate-300 ${className}`}>{children}</td>;
}

export function ScannerRow({ symbol }: { symbol: string }) {
  const market = useBinanceMarket(symbol);
  const analysis = useSymbolAnalysis(symbol);

  const price = market?.ticker?.lastPrice ?? market?.markPrice?.markPrice;
  const change = market?.ticker?.priceChangePercent;
  const primary = analysis?.timeframes['1h'];

  return (
    <tr className="border-b border-slate-800/70 last:border-b-0 hover:bg-slate-900/40">
      <Cell className="font-medium text-slate-100">{symbol.replace(/USDT$/, '')}</Cell>
      <Cell>{formatUsdPrice(price)}</Cell>
      <Cell className={(change ?? 0) > 0 ? 'text-emerald-400' : (change ?? 0) < 0 ? 'text-rose-400' : ''}>
        {formatPercent(change)}
      </Cell>
      <Cell>{primary ? trendLabels[primary.trend.classification] : '…'}</Cell>
      <Cell>{primary ? momentumLabels[primary.momentum.classification] : '…'}</Cell>
      <Cell>{analysis?.volume.relativeVolume !== undefined && analysis.volume.relativeVolume !== null ? `${analysis.volume.relativeVolume.toFixed(1)}x` : '—'}</Cell>
      <Cell>{primary ? volatilityLabels[primary.volatility.classification] : '…'}</Cell>
      <Cell>
        {analysis?.positioning.oiChange4hPct !== undefined && analysis.positioning.oiChange4hPct !== null
          ? formatPercent(analysis.positioning.oiChange4hPct)
          : '—'}
      </Cell>
      <Cell>
        {analysis
          ? `${formatFundingRate(analysis.positioning.fundingRate ?? undefined)} · ${fundingStateLabels[analysis.positioning.fundingState]}`
          : '…'}
      </Cell>
      <Cell>{primary ? structureLabels[primary.structure.signal] : '…'}</Cell>
      <Cell>
        {analysis ? (
          <AttentionBadge symbol={symbol} level={analysis.attention} explanation={analysis.explanation} />
        ) : (
          '…'
        )}
      </Cell>
    </tr>
  );
}
