import { failedBreakoutReversal } from './failedBreakoutReversal';
import { momentumDivergenceReversal } from './momentumDivergenceReversal';
import { rangeBreakout } from './rangeBreakout';
import type { FamilyDefinition } from './shared';
import { trendContinuationBreakout } from './trendContinuationBreakout';
import { trendContinuationPullback } from './trendContinuationPullback';
import { volatilityCompressionBreakout } from './volatilityCompressionBreakout';

export const ALL_FAMILIES: FamilyDefinition[] = [
  trendContinuationBreakout,
  trendContinuationPullback,
  rangeBreakout,
  failedBreakoutReversal,
  momentumDivergenceReversal,
  volatilityCompressionBreakout,
];

export {
  trendContinuationBreakout,
  trendContinuationPullback,
  rangeBreakout,
  failedBreakoutReversal,
  momentumDivergenceReversal,
  volatilityCompressionBreakout,
};
export type { FamilyDefinition, FamilyEvaluationInput, FamilyResult } from './shared';
