import type { FuturesSymbol } from '../../services/binance/types';
import type { SymbolMarketData } from '../../store/marketDataStore';
import { analyseSymbol } from './analyseSymbol';
import { historyBuffer } from './historyBuffer';
import type { SymbolAnalysis } from './types';

/** Analyses every symbol in the given universe, ranking by 24h quote volume first. */
export function analyseUniverse(
  universe: FuturesSymbol[],
  bySymbol: Record<string, SymbolMarketData>,
  calculatedAt = Date.now(),
): Record<string, SymbolAnalysis> {
  const ranked = [...universe]
    .map((s) => ({ symbol: s.symbol, quoteVolume: bySymbol[s.symbol]?.ticker?.quoteVolume ?? 0 }))
    .sort((a, b) => b.quoteVolume - a.quoteVolume);
  const rankBySymbol = new Map(ranked.map((r, i) => [r.symbol, i + 1]));
  const universeSize = universe.length;

  const result: Record<string, SymbolAnalysis> = {};
  for (const { symbol } of universe) {
    const data = bySymbol[symbol];
    if (!data) continue;
    result[symbol] = analyseSymbol({
      symbol,
      candles: data.candles,
      ticker: data.ticker,
      markPrice: data.markPrice,
      funding: data.funding,
      openInterest: data.openInterest,
      quoteVolumeRank: rankBySymbol.get(symbol) ?? null,
      universeSize,
      oiHistory: historyBuffer.getOiHistory(symbol),
      fundingHistory: historyBuffer.getFundingHistory(symbol),
      calculatedAt,
    });
  }
  return result;
}
