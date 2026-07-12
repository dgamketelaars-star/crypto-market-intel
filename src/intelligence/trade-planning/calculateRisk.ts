import type { VolatilityClassification } from '../../analysis/engine/types';
import type { CategoryEvidence } from '../evidence/types';
import { INTEL_RULES } from '../rules';
import type { ThesisDirection } from '../structure/entryLocation';
import { leansWith, stronglyOpposes, type RiskLevel } from '../thesis/types';

/**
 * A round-number proxy, not real liquidation data — this app has no
 * liquidation stream (see the trade-planning spec's derivatives caveat). A
 * stop landing near a round number is flagged as elevated stop-hunt *risk*,
 * never treated as a guaranteed reaction level.
 */
function isNearRoundNumber(price: number): boolean {
  if (price <= 0) return false;
  const magnitude = 10 ** Math.floor(Math.log10(price));
  const nearestRound = Math.round(price / magnitude) * magnitude;
  return Math.abs(price - nearestRound) / price <= INTEL_RULES.tradePlanning.roundNumberTolerancePct / 100;
}

export interface RiskInput {
  direction: ThesisDirection;
  volatilityClassification: VolatilityClassification;
  stopDistance: number;
  stopFloor: number;
  invalidationPrice: number;
  derivativesEvidence: CategoryEvidence;
  btcContextEvidence: CategoryEvidence;
  quoteVolumeRank: number | null;
  universeSize: number | null;
  nearestTargetRewardToRisk: number | null;
  priceVsEma200Pct: number | null;
}

export interface RiskResult {
  risk: RiskLevel;
  factors: string[];
}

/**
 * Independent of Signal Strength (see the evidence-hierarchy spec §7) — a
 * High-strength thesis can still carry High risk. Each elevated factor
 * pushes the level up one notch; multiple simultaneous factors compound
 * rather than average. This is a first-pass, documented heuristic (the
 * factor list is fixed now; exact per-factor cutoffs are expected to be
 * recalibrated once real trade outcomes are observable).
 */
export function calculateRisk(input: RiskInput): RiskResult {
  const { direction, volatilityClassification, stopDistance, stopFloor, invalidationPrice, derivativesEvidence, btcContextEvidence, quoteVolumeRank, universeSize, nearestTargetRewardToRisk, priceVsEma200Pct } = input;

  const factors: string[] = [];
  let score = 0;

  if (volatilityClassification === 'extreme') {
    score += 2;
    factors.push('Extreme volatility');
  } else if (volatilityClassification === 'elevated') {
    score += 1;
    factors.push('Elevated volatility');
  }

  if (stopFloor > 0 && stopDistance / stopFloor < 1.2) {
    score += 1;
    factors.push('Stop sits close to the structural sanity floor — more prone to noise stop-outs');
  }

  if (stronglyOpposes(direction, derivativesEvidence) || derivativesEvidence.opposing.some((f) => f.description.toLowerCase().includes('crowded'))) {
    score += 1;
    factors.push('Derivatives positioning/funding crowding is a headwind for this direction');
  }

  if (!leansWith(direction, btcContextEvidence) && btcContextEvidence.conclusion !== 'neutral') {
    score += 1;
    factors.push('BTC/ETH market context does not confirm this direction');
  }

  if (quoteVolumeRank !== null && universeSize !== null && universeSize > 0 && quoteVolumeRank > universeSize * 0.75) {
    score += 1;
    factors.push('Low liquidity rank within the tracked universe');
  }

  if (nearestTargetRewardToRisk !== null && nearestTargetRewardToRisk < 1.8) {
    score += 1;
    factors.push('Nearest target offers thin reward relative to risk');
  }

  if (priceVsEma200Pct !== null && Math.abs(priceVsEma200Pct) > 15) {
    score += 1;
    factors.push('Price is significantly extended from its 200-EMA');
  }

  if (isNearRoundNumber(invalidationPrice)) {
    score += 1;
    factors.push('Stop sits near a round-number level — a proxy stop-hunt risk, not a guaranteed reaction level');
  }

  const risk: RiskLevel = score <= 1 ? 'Low' : score <= 3 ? 'Medium' : score <= 5 ? 'High' : 'Very high';
  return { risk, factors };
}
