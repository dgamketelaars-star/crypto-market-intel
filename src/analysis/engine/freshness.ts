import { RULES } from './rules';
import type { AnalysisFreshness } from './types';

export function buildFreshness(dataTimestamp: number, calculatedAt: number = Date.now()): AnalysisFreshness {
  return {
    dataTimestamp,
    calculatedAt,
    stale: dataTimestamp <= 0 || calculatedAt - dataTimestamp > RULES.freshness.staleAfterMs,
  };
}
