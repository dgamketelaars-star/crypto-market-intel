import type { FundingState, VolatilityClassification } from '../../analysis/engine/types';
import type { SetupDirection, SetupRisk } from '../engine/types';

export interface RiskScoringInput {
  direction: SetupDirection;
  volatility: VolatilityClassification;
  quoteVolumeRank: number | null;
  universeSize: number | null;
  fundingState: FundingState;
  timeframeConflict: boolean;
  /** Distance to the nearest opposing support/resistance zone, in ATR units. Small = high risk. */
  nearOpposingZoneAtrRatio: number | null;
  rewardToRisk: number | null;
  btcContextAdverse: boolean;
  missingDataCount: number;
}

/**
 * Additive, documented risk score (0..~10) mapped to a 4-level scale.
 * Risk describes "how unstable/difficult", independent of signal strength —
 * a setup can be High strength and High risk at the same time.
 */
export function calculateRisk(input: RiskScoringInput): SetupRisk {
  let score = 0;

  if (input.volatility === 'extreme') score += 2;
  else if (input.volatility === 'elevated') score += 1;

  if (input.universeSize && input.quoteVolumeRank) {
    const relativeRank = input.quoteVolumeRank / input.universeSize;
    if (relativeRank > 0.75) score += 2;
    else if (relativeRank > 0.5) score += 1;
  }

  const extremeFunding =
    (input.direction === 'LONG' && input.fundingState === 'very_elevated') ||
    (input.direction === 'SHORT' && input.fundingState === 'very_low');
  if (extremeFunding) score += 2;
  else if (input.fundingState === 'elevated' || input.fundingState === 'low') score += 1;

  if (input.timeframeConflict) score += 1;

  if (input.nearOpposingZoneAtrRatio !== null) {
    if (input.nearOpposingZoneAtrRatio < 1) score += 2;
    else if (input.nearOpposingZoneAtrRatio < 2) score += 1;
  }

  if (input.rewardToRisk !== null && input.rewardToRisk < 1.5) score += 1;

  if (input.btcContextAdverse) score += 1;

  score += Math.min(input.missingDataCount, 2);

  if (score >= 7) return 'Very high';
  if (score >= 5) return 'High';
  if (score >= 3) return 'Medium';
  return 'Low';
}
