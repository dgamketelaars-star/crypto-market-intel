import type { SymbolAnalysis } from '../../analysis/engine/types';
import type { FamilyResult } from '../families/shared';
import { SETUP_RULES } from './rules';
import type { SetupDirection, TradeHorizon } from './types';

/** The duration text shown on a setup card — derived from the classification, not a per-family guess, so it always matches the horizon the levels were actually built for. */
export const expectedDurationLabel: Record<TradeHorizon, string> = {
  DAY_TRADE: '4–24 uur',
  SWING_TRADE: '1–7 dagen',
};

export interface HorizonClassification {
  horizon: TradeHorizon | null;
  reason: string;
  atr1h: number;
  atr4h: number | null;
  /** Distance from trigger to the furthest candidate target — the scale used to judge how long the move should realistically take. */
  rewardDistance: number;
  rewardInAtr1h: number;
  rewardInAtr4h: number | null;
}

function trendConflicts(direction: SetupDirection, classification: string | undefined): boolean {
  if (!classification) return false;
  return (direction === 'LONG' && classification === 'downtrend') || (direction === 'SHORT' && classification === 'uptrend');
}

/**
 * Classifies a fresh family result into a DAY_TRADE or SWING_TRADE horizon
 * — or rejects it outright when neither is defensible — *before* any
 * stoploss/target distance validation runs (see qualityGate.ts, which takes
 * this classification as an input rather than re-deriving it).
 *
 * All 6 current setup families are structurally 1H pattern families: their
 * trigger/invalidation/entry-zone all derive from 1H structure and 1H ATR
 * (see the codebase survey — 4H/1D are only used as trend-classification
 * context gates today, never as a primary structural timeframe). Rather
 * than pretending otherwise, classification here judges the *scale* of the
 * move the family already computed — expressed in both 1H and 4H ATR — and
 * cross-checks it against the higher-timeframe trend context the spec
 * requires:
 *
 * DAY_TRADE — all of:
 *  - the reward distance (trigger to the furthest candidate target) is
 *    between `horizon.dayTrade.minRewardAtr1hMult` (1.0) and
 *    `maxRewardAtr1hMult` (8.0) multiples of 1H ATR — big enough to be a
 *    real move, small enough to plausibly land within 4–24 hours;
 *  - 4H trend does not directly oppose the setup direction.
 *
 * SWING_TRADE — all of:
 *  - the reward distance is at least `minRewardAtr1hMult` (8.0) multiples
 *    of 1H ATR *and* at least `minRewardAtr4hMult` (1.0) multiples of 4H
 *    ATR — large relative to ordinary 1H noise AND still meaningful on the
 *    4H chart, not just a big number on a small timeframe;
 *  - 1D trend does not directly oppose the setup direction.
 *
 * These two reward-scale bands are disjoint by construction (the day-trade
 * ceiling is the swing-trade floor), so a result never qualifies for both.
 * A result that clears neither band, or has no target to measure at all,
 * is rejected — not degraded to a lower-quality label.
 */
export function classifyTradeHorizon(result: FamilyResult, analysis: SymbolAnalysis): HorizonClassification {
  const atr1h = result.atr;
  const tf4h = analysis.timeframes['4h'];
  const tf1d = analysis.timeframes['1d'];
  const atr4h = tf4h?.volatility.sufficientData ? (tf4h.volatility.atr14.value ?? null) : null;

  const base: Pick<HorizonClassification, 'atr1h' | 'atr4h'> = { atr1h, atr4h };

  if (atr1h <= 0) {
    return { ...base, horizon: null, reason: 'Onvoldoende 1H-volatiliteitsdata om een trade-horizon te bepalen.', rewardDistance: 0, rewardInAtr1h: 0, rewardInAtr4h: null };
  }
  if (result.targets.length === 0) {
    return { ...base, horizon: null, reason: 'Geen koersdoel beschikbaar om de horizon-schaal op te baseren.', rewardDistance: 0, rewardInAtr1h: 0, rewardInAtr4h: null };
  }

  const furthestTarget = result.targets.reduce((furthest, t) => {
    const dist = Math.abs(t.price - result.trigger.price);
    const furthestDist = Math.abs(furthest.price - result.trigger.price);
    return dist > furthestDist ? t : furthest;
  }, result.targets[0]);
  const rewardDistance = Math.abs(furthestTarget.price - result.trigger.price);
  const rewardInAtr1h = rewardDistance / atr1h;
  const rewardInAtr4h = atr4h && atr4h > 0 ? rewardDistance / atr4h : null;

  const { dayTrade, swingTrade } = SETUP_RULES.horizon;

  const day4hConflict = trendConflicts(result.direction, tf4h?.trend.sufficientData ? tf4h.trend.classification : undefined);
  const dayScaleOk = rewardInAtr1h >= dayTrade.minRewardAtr1hMult && rewardInAtr1h < dayTrade.maxRewardAtr1hMult;
  if (dayScaleOk && !day4hConflict) {
    return {
      ...base,
      horizon: 'DAY_TRADE',
      reason: `Reward (${rewardInAtr1h.toFixed(2)}x 1H ATR) past bij een day trade en 4H-trend staat niet tegenover de richting.`,
      rewardDistance,
      rewardInAtr1h,
      rewardInAtr4h,
    };
  }

  const day1dConflict = trendConflicts(result.direction, tf1d?.trend.sufficientData ? tf1d.trend.classification : undefined);
  const swingScaleOk = rewardInAtr1h >= swingTrade.minRewardAtr1hMult && rewardInAtr4h !== null && rewardInAtr4h >= swingTrade.minRewardAtr4hMult;
  if (swingScaleOk && !day1dConflict) {
    return {
      ...base,
      horizon: 'SWING_TRADE',
      reason: `Reward (${rewardInAtr1h.toFixed(2)}x 1H ATR, ${rewardInAtr4h?.toFixed(2)}x 4H ATR) vereist een swing-horizon en 1D-trend staat niet tegenover de richting.`,
      rewardDistance,
      rewardInAtr1h,
      rewardInAtr4h,
    };
  }

  const scaleReason = dayScaleOk
    ? '4H-trend staat tegenover de richting van de day trade.'
    : swingScaleOk
      ? '1D-trend staat tegenover de richting van de swing trade.'
      : `Reward-schaal (${rewardInAtr1h.toFixed(2)}x 1H ATR${rewardInAtr4h !== null ? `, ${rewardInAtr4h.toFixed(2)}x 4H ATR` : ''}) past bij geen van beide horizons.`;

  return {
    ...base,
    horizon: null,
    reason: `Geen defensible trade-horizon: ${scaleReason}`,
    rewardDistance,
    rewardInAtr1h,
    rewardInAtr4h,
  };
}
