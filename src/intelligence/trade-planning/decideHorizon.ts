import type { Candle } from '../../services/binance/types';
import type { TradeHorizon } from '../../setups/engine/types';
import { findNearestDefensibleZone, type DefensibleZone, type ThesisDirection } from '../structure/entryLocation';

export interface HorizonDecision {
  horizon: TradeHorizon;
  zone: DefensibleZone;
  /** Candles the entry/stop/target builders should use — 1H for a day trade, 4H for a swing trade. */
  structuralCandles: Candle[];
  atr: number | null;
}

/**
 * Horizon is decided BEFORE any level is built, from which timeframe stack
 * actually has a tradeable structure right now — never derived afterward
 * from a generated target's distance (the old engine's banned anti-pattern).
 * 1H is checked first: if a fresh, defensible zone exists there, this is a
 * day trade, built entirely from the 1H/4H stack. Only when 1H has nothing
 * usable does it fall back to the swing stack (4H/1D) — which the thesis
 * already required to have a valid zone to reach this point at all.
 */
export function decideTradeHorizon(params: {
  direction: ThesisDirection;
  candles1h: Candle[];
  candles4h: Candle[];
  price: number;
  atr1h: number | null;
  atr4h: number | null;
}): HorizonDecision | null {
  const { direction, candles1h, candles4h, price, atr1h, atr4h } = params;

  const dayZone = findNearestDefensibleZone(direction, candles1h, price, atr1h);
  if (dayZone) {
    return { horizon: 'DAY_TRADE', zone: dayZone, structuralCandles: candles1h, atr: atr1h };
  }

  const swingZone = findNearestDefensibleZone(direction, candles4h, price, atr4h);
  if (swingZone) {
    return { horizon: 'SWING_TRADE', zone: swingZone, structuralCandles: candles4h, atr: atr4h };
  }

  return null;
}
