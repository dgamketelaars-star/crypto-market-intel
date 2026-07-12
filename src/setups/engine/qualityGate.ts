import type { FamilyResult } from '../families/shared';
import { SETUP_RULES } from './rules';
import { classifyTradeHorizon, type HorizonClassification } from './tradeHorizon';
import type { SetupTargetCandidate, TradeHorizon } from './types';

export interface QualityCheckResult {
  valid: boolean;
  /** Human-readable reason a result was rejected — debug/logging use only, never shown to normal users. */
  reason: string | null;
  horizon: TradeHorizon | null;
  /** Targets surviving horizon-distance + degenerate-R:R filtering — only meaningful when `valid`. */
  targets: SetupTargetCandidate[];
}

function stopDistanceFloor(horizon: TradeHorizon, atr1h: number, atr4h: number | null): number | null {
  if (horizon === 'DAY_TRADE') return atr1h * SETUP_RULES.horizon.dayTrade.minStopAtr1hMult;
  if (atr4h === null) return null; // no 4H ATR data -> can't validate a swing stop at all
  return atr4h * SETUP_RULES.horizon.swingTrade.minStopAtr4hMult;
}

function targetDistanceFloor(horizon: TradeHorizon, atr1h: number, atr4h: number | null): number | null {
  if (horizon === 'DAY_TRADE') return atr1h * SETUP_RULES.horizon.dayTrade.minTargetAtr1hMult;
  if (atr4h === null) return null;
  return atr4h * SETUP_RULES.horizon.swingTrade.minTargetAtr4hMult;
}

/** True when a target's R:R looks inflated because the *risk* side is only barely past the horizon's minimum floor — not because the plan itself is strong. */
function isDegenerateRewardToRisk(rewardToRisk: number | null, stopDistance: number, relevantAtr: number): boolean {
  if (rewardToRisk === null) return false;
  if (rewardToRisk <= SETUP_RULES.rrSanity.reviewCeiling) return false;
  const riskInAtr = stopDistance / relevantAtr;
  return riskInAtr < SETUP_RULES.rrSanity.safeAtrRiskMult;
}

/**
 * The single funnel every fresh family result must pass through before it's
 * allowed to become or advance a GeneratedSetup. Quality over quantity: a
 * setup that fails any of these checks is not a setup — reject it outright,
 * don't degrade it to a lower status and show it anyway. Applied once, in
 * evaluateSymbolSetups.ts, so every family gets the same bar.
 *
 * Order of operations (mirrors the required validation sequence — horizon
 * first, then everything else is judged against it):
 * 1. Classify the trade horizon (tradeHorizon.ts). No defensible horizon ->
 *    reject immediately; nothing below this point is even evaluated.
 * 2. Stoploss must be on the correct side of the *entire* entry zone —
 *    below it for LONG, above it for SHORT.
 * 3. Stoploss must clear the horizon-appropriate minimum ATR distance from
 *    the trigger (1H ATR for a day trade, 4H ATR for a swing trade — never
 *    derived mainly from a smaller timeframe's noise).
 * 4. Each candidate target is individually filtered: it must clear the
 *    horizon-appropriate minimum ATR distance, and its R:R must not be a
 *    mathematical artifact of a barely-passing stop (see
 *    isDegenerateRewardToRisk). Targets that survive keep their place;
 *    targets that don't are dropped, not the whole setup — unless nothing
 *    survives, which is its own rejection ("no targets means no setup").
 */
export function evaluateSetupQuality(result: FamilyResult, analysis: Parameters<typeof classifyTradeHorizon>[1]): QualityCheckResult {
  const classification: HorizonClassification = classifyTradeHorizon(result, analysis);
  if (!classification.horizon) {
    return { valid: false, reason: classification.reason, horizon: null, targets: [] };
  }
  const horizon = classification.horizon;
  const { atr1h, atr4h } = classification;

  const isLong = result.direction === 'LONG';
  const entryLow = result.entryZone ? Math.min(result.entryZone.low, result.entryZone.high) : result.trigger.price;
  const entryHigh = result.entryZone ? Math.max(result.entryZone.low, result.entryZone.high) : result.trigger.price;

  const stoplossCorrectSide = isLong ? result.invalidation.price < entryLow : result.invalidation.price > entryHigh;
  if (!stoplossCorrectSide) {
    return { valid: false, reason: 'Stoploss staat niet aan de juiste kant van de volledige entry zone.', horizon, targets: [] };
  }

  const stopDistance = Math.abs(result.trigger.price - result.invalidation.price);
  const minStopDistance = stopDistanceFloor(horizon, atr1h, atr4h);
  if (minStopDistance === null) {
    return { valid: false, reason: 'Geen 4H ATR beschikbaar om een swing-stoploss te valideren.', horizon, targets: [] };
  }
  if (stopDistance < minStopDistance) {
    const atrLabel = horizon === 'DAY_TRADE' ? '1H' : '4H';
    return {
      valid: false,
      reason: `Stop staat te dicht op de trigger voor een ${horizon === 'DAY_TRADE' ? 'day trade' : 'swing trade'}: afstand ${stopDistance} < minimale structurele afstand ${minStopDistance} (${atrLabel} ATR-gebaseerd).`,
      horizon,
      targets: [],
    };
  }

  const minTargetDistance = targetDistanceFloor(horizon, atr1h, atr4h);
  if (minTargetDistance === null) {
    return { valid: false, reason: 'Geen 4H ATR beschikbaar om swing-targets te valideren.', horizon, targets: [] };
  }
  const relevantAtr = horizon === 'DAY_TRADE' ? atr1h : (atr4h as number);

  const survivingTargets = result.targets.filter((target) => {
    const targetDistance = Math.abs(target.price - result.trigger.price);
    if (targetDistance < minTargetDistance) return false;
    if (isDegenerateRewardToRisk(target.rewardToRisk, stopDistance, relevantAtr)) return false;
    return true;
  });

  if (survivingTargets.length === 0) {
    return {
      valid: false,
      reason: 'Geen koersdoel haalt de minimale horizon-afstand of reward:risk zonder een verdacht kleine stop — geen realistisch profit target.',
      horizon,
      targets: [],
    };
  }

  return { valid: true, reason: null, horizon, targets: survivingTargets };
}
