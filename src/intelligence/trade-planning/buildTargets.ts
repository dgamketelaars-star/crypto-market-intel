import type { Candle, CandleInterval } from '../../services/binance/types';
import type { VolatilityClassification } from '../../analysis/engine/types';
import { findSupportResistanceZones } from '../../analysis/structure/supportResistance';
import { calculateRewardToRisk } from '../../setups/levels/rewardToRisk';
import { finalizeTargets } from '../../setups/levels/targetPortions';
import type { SetupTarget, SetupTargetCandidate, TradeHorizon } from '../../setups/engine/types';
import { INTEL_RULES } from '../rules';
import type { ThesisDirection } from '../structure/entryLocation';

function targetDistanceFloor(horizon: TradeHorizon, atr1h: number | null, atr4h: number | null): number | null {
  if (horizon === 'DAY_TRADE') return atr1h !== null ? atr1h * INTEL_RULES.tradePlanning.horizon.dayTrade.minTargetAtr1hMult : null;
  return atr4h !== null ? atr4h * INTEL_RULES.tradePlanning.horizon.swingTrade.minTargetAtr4hMult : null;
}

/** Same "R:R that only looks big because the stop is tiny" sanity check the paused engine used (see setups/engine/qualityGate.ts). */
function isDegenerateRewardToRisk(rewardToRisk: number | null, stopDistance: number, relevantAtr: number): boolean {
  if (rewardToRisk === null) return false;
  if (rewardToRisk <= INTEL_RULES.tradePlanning.rrSanity.reviewCeiling) return false;
  return stopDistance / relevantAtr < INTEL_RULES.tradePlanning.rrSanity.safeAtrRiskMult;
}

/** Zone candidates within this tolerance of each other are the same target, not two — keeps the plan from showing near-duplicate levels. */
function mergeOverlappingZones(zones: { price: number; touches: number }[]): { price: number; touches: number }[] {
  const tolerance = INTEL_RULES.tradePlanning.entryZoneTolerancePct / 100;
  const sorted = [...zones].sort((a, b) => a.price - b.price);
  const merged: { price: number; touches: number }[] = [];
  for (const zone of sorted) {
    const last = merged[merged.length - 1];
    if (last && Math.abs(zone.price - last.price) / last.price <= tolerance) {
      last.touches += zone.touches;
      last.price = (last.price + zone.price) / 2;
    } else {
      merged.push({ ...zone });
    }
  }
  return merged;
}

/**
 * Targets are structure-sourced only — the opposite-side support/resistance
 * zones beyond the entry, never an arbitrary ATR multiple or a fixed
 * risk-multiple. Each candidate must clear the horizon's minimum ATR
 * distance (no scalp-size targets) and must not be a degenerate R:R
 * artifact of a barely-passing stop. Overlapping zone candidates are merged
 * before filtering so the plan never shows two near-duplicate levels.
 */
export function buildTargets(params: {
  direction: ThesisDirection;
  triggerPrice: number;
  invalidationPrice: number;
  structuralCandles: Candle[];
  horizon: TradeHorizon;
  atr1h: number | null;
  atr4h: number | null;
  volatility: VolatilityClassification;
  timeframe: CandleInterval;
}): SetupTarget[] {
  const { direction, triggerPrice, invalidationPrice, structuralCandles, horizon, atr1h, atr4h, volatility, timeframe } = params;
  const stopDistance = Math.abs(triggerPrice - invalidationPrice);

  const { supports, resistances } = findSupportResistanceZones(structuralCandles, triggerPrice);
  const candidateZones = mergeOverlappingZones(direction === 'LONG' ? resistances : supports);

  const minDistance = targetDistanceFloor(horizon, atr1h, atr4h);
  if (minDistance === null) return [];
  const relevantAtr = horizon === 'DAY_TRADE' ? atr1h : atr4h;
  if (relevantAtr === null) return [];

  const candidates: SetupTargetCandidate[] = candidateZones
    .map((zone) => {
      const distance = Math.abs(zone.price - triggerPrice);
      const rewardToRisk = calculateRewardToRisk(triggerPrice, zone.price, invalidationPrice, direction);
      return {
        price: zone.price,
        timeframe,
        method: 'opposite-side-structural-zone',
        explanation: `Structural ${direction === 'LONG' ? 'resistance' : 'support'} zone at ${zone.price.toFixed(4)} (${zone.touches} touches).`,
        rewardToRisk,
        distance,
      };
    })
    .filter((c) => c.distance >= minDistance && (c.rewardToRisk ?? 0) >= INTEL_RULES.tradePlanning.rewardToRisk.minimum && !isDegenerateRewardToRisk(c.rewardToRisk, stopDistance, relevantAtr))
    .map(({ distance: _distance, ...candidate }) => candidate);

  return finalizeTargets(candidates, direction, volatility);
}
