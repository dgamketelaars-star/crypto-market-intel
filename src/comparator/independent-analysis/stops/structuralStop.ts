import type { IndependentAnalysisDirection } from '../adapters/independentAnalysisSetup';

/** Stop sits just beyond the extreme of the candle that swept the liquidity zone — our own assembly, see signals/liquiditySweepReversal.ts. */
export function isStopHit(currentPrice: number, stopPrice: number, direction: IndependentAnalysisDirection): boolean {
  return direction === 'LONG' ? currentPrice <= stopPrice : currentPrice >= stopPrice;
}
