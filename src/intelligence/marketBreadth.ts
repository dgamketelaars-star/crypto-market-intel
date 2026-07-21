import type { SymbolAnalysis } from '../analysis/engine/types';

/** Fraction of the Top-50 universe (excluding BTC/ETH) whose 4H trend is a decisive uptrend, among symbols with a decisive (uptrend/downtrend) read. */
export function computeBreadthBullishSharePct(bySymbol: Record<string, SymbolAnalysis>): number | null {
  const decisive = Object.entries(bySymbol)
    .filter(([symbol]) => symbol !== 'BTCUSDT' && symbol !== 'ETHUSDT')
    .map(([, a]) => a.timeframes['4h']?.trend)
    .filter((t): t is NonNullable<typeof t> => !!t?.sufficientData && (t.classification === 'uptrend' || t.classification === 'downtrend'));
  if (decisive.length === 0) return null;
  return decisive.filter((t) => t.classification === 'uptrend').length / decisive.length;
}
