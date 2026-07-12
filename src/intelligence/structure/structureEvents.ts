import type { Candle } from '../../services/binance/types';
import { findSupportResistanceZones, findSwingPoints, type SwingPoint } from '../../analysis/structure/supportResistance';
import { INTEL_RULES } from '../rules';

export type StructureEvent =
  | 'bullish_bos'
  | 'bearish_bos'
  | 'bullish_choch'
  | 'bearish_choch'
  | 'none'
  | 'insufficient_data';

export interface StructureEventResult {
  event: StructureEvent;
  /** The swing point this event broke past, if any. */
  brokenLevel: SwingPoint | null;
}

/**
 * BOS (break of structure) = price breaks past the most recent swing point
 * *in the direction the existing swing pattern already implied* — a
 * continuation confirmation. CHOCH (change of character) = price breaks
 * past a swing point *against* the prevailing swing pattern — the first
 * warning sign of a reversal. Both are read off the same swing points the
 * old engine already computes (see analysis/structure/supportResistance.ts),
 * just interpreted more richly than a flat HH/HL comparison.
 */
export function detectStructureEvent(candles: Candle[]): StructureEventResult {
  const { highs, lows } = findSwingPoints(candles);
  if (highs.length < 2 || lows.length < 2) return { event: 'insufficient_data', brokenLevel: null };

  const lastClose = candles[candles.length - 1].close;
  const [prevHigh, lastHigh] = highs.slice(-2);
  const [prevLow, lastLow] = lows.slice(-2);
  const priorPattern: 'up' | 'down' | 'mixed' =
    lastHigh.price > prevHigh.price && lastLow.price > prevLow.price
      ? 'up'
      : lastHigh.price < prevHigh.price && lastLow.price < prevLow.price
        ? 'down'
        : 'mixed';

  // A break above the most recent swing high: continuation (BOS) if the pattern was already up,
  // a reversal warning (CHOCH) if the pattern was down or mixed.
  if (lastClose > lastHigh.price) {
    return { event: priorPattern === 'up' ? 'bullish_bos' : 'bullish_choch', brokenLevel: lastHigh };
  }
  // A break below the most recent swing low: continuation if the pattern was already down, reversal warning otherwise.
  if (lastClose < lastLow.price) {
    return { event: priorPattern === 'down' ? 'bearish_bos' : 'bearish_choch', brokenLevel: lastLow };
  }

  return { event: 'none', brokenLevel: null };
}

export interface RetestResult {
  /** True when price broke a level and has since pulled back to retest it (within tolerance) without closing back through it. */
  isRetesting: boolean;
  level: number | null;
}

/**
 * After a break, "retesting" means price has come back to touch the broken
 * level from the new side and held — a classic higher-quality entry
 * location versus chasing the initial break.
 */
export function detectRetest(candles: Candle[], direction: 'bullish' | 'bearish'): RetestResult {
  const lookback = INTEL_RULES.structure.retestLookback;
  const tolerance = INTEL_RULES.structure.retestTolerancePct / 100;
  const window = candles.slice(-lookback - 1);
  if (window.length < 3) return { isRetesting: false, level: null };

  const { event, brokenLevel } = detectStructureEvent(candles.slice(0, -1));
  const relevantEvent = direction === 'bullish' ? event === 'bullish_bos' || event === 'bullish_choch' : event === 'bearish_bos' || event === 'bearish_choch';
  if (!relevantEvent || !brokenLevel) return { isRetesting: false, level: null };

  const lastClose = candles[candles.length - 1].close;
  const withinTolerance = Math.abs(lastClose - brokenLevel.price) / brokenLevel.price <= tolerance;
  const heldSide = direction === 'bullish' ? lastClose >= brokenLevel.price * (1 - tolerance) : lastClose <= brokenLevel.price * (1 + tolerance);

  return { isRetesting: withinTolerance && heldSide, level: brokenLevel.price };
}

export type FailedBreakDirection = 'failed_breakout' | 'failed_breakdown' | 'none' | 'insufficient_data';

/**
 * Symmetric pair the old engine only had one half of (analysis/structure/breakout.ts
 * detects failed_breakout but never failed_breakdown). A failed break is price
 * clearing a zone, then closing back inside it within the lookback window —
 * a rejection, often a higher-conviction signal in the opposite direction.
 */
export function detectFailedBreak(candles: Candle[], currentPrice: number): FailedBreakDirection {
  const lookback = INTEL_RULES.structure.retestLookback;
  if (candles.length < lookback + 5) return 'insufficient_data';

  const priorCandles = candles.slice(0, -lookback);
  const referencePrice = priorCandles[priorCandles.length - 1]?.close ?? currentPrice;
  const { supports, resistances } = findSupportResistanceZones(priorCandles, referencePrice);
  const nearestResistance = resistances[0];
  const nearestSupport = supports[0];
  const recentWindow = candles.slice(-lookback);

  if (nearestResistance) {
    const clearedAbove = recentWindow.some((c) => c.high > nearestResistance.price);
    if (clearedAbove && currentPrice < nearestResistance.price) return 'failed_breakout';
  }
  if (nearestSupport) {
    const clearedBelow = recentWindow.some((c) => c.low < nearestSupport.price);
    if (clearedBelow && currentPrice > nearestSupport.price) return 'failed_breakdown';
  }
  return 'none';
}
