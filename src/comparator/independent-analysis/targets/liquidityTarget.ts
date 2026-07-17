import type { IndependentAnalysisDirection } from '../adapters/independentAnalysisSetup';

/** Target is the nearest un-swept opposing liquidity zone (or a structural swing fallback) — see signals/liquiditySweepReversal.ts. */
export function isTargetHit(currentPrice: number, targetPrice: number, direction: IndependentAnalysisDirection): boolean {
  return direction === 'LONG' ? currentPrice >= targetPrice : currentPrice <= targetPrice;
}
