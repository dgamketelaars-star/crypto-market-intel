import type { Candle } from '../../services/binance/types';
import type { StructureSignal, SupportResistanceZone } from '../engine/types';
import { RULES } from '../engine/rules';
import { findSupportResistanceZones } from './supportResistance';

export interface BreakoutResult {
  signal: StructureSignal;
  nearestSupport: SupportResistanceZone | null;
  nearestResistance: SupportResistanceZone | null;
}

/**
 * Compares the latest close against support/resistance zones built from all
 * *prior* candles (so the breakout check isn't circular against itself).
 */
export function analyseBreakout(candles: Candle[]): BreakoutResult {
  const minCandles = RULES.structure.swingLookback * 2 + 6;
  if (candles.length < minCandles) {
    return { signal: 'insufficient_data', nearestSupport: null, nearestResistance: null };
  }

  const lastCandle = candles[candles.length - 1];
  const priorCandles = candles.slice(0, -1);
  const currentPrice = lastCandle.close;
  const buffer = RULES.structure.breakoutBufferPct / 100;

  // Zones are classified relative to where price *was* (the previous close),
  // not the candle we're testing for a breakout — otherwise a zone stops
  // counting as "resistance" the moment price actually breaks above it,
  // which would make a real breakout undetectable.
  const referencePrice = priorCandles[priorCandles.length - 1]?.close ?? currentPrice;
  const { supports, resistances } = findSupportResistanceZones(priorCandles, referencePrice);
  const nearestResistance = resistances[0] ?? null;
  const nearestSupport = supports[0] ?? null;

  let signal: StructureSignal = 'none';

  if (nearestResistance && currentPrice > nearestResistance.price * (1 + buffer)) {
    signal = 'breakout_candidate';
  } else if (nearestSupport && currentPrice < nearestSupport.price * (1 - buffer)) {
    signal = 'breakdown_candidate';
  } else if (nearestResistance) {
    const prevClose = priorCandles[priorCandles.length - 1]?.close;
    if (
      prevClose !== undefined &&
      prevClose > nearestResistance.price * (1 + buffer) &&
      currentPrice <= nearestResistance.price
    ) {
      signal = 'failed_breakout';
    }
  }

  return { signal, nearestSupport, nearestResistance };
}
