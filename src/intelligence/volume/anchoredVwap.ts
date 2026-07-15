import type { Candle } from '../../services/binance/types';
import { findSwingPoints } from '../../analysis/structure/supportResistance';

export interface AnchoredVwapResult {
  anchorIndex: number;
  anchorPrice: number;
  vwap: number;
}

/**
 * VWAP anchored to the most recent swing pivot, rather than a fixed rolling
 * window (see analysis/indicators/vwap.ts, which is the rolling variant
 * used elsewhere) — this answers "what's fair value since the last thing
 * that mattered happened", the institutional-execution-benchmark framing
 * professional desks use an anchored VWAP for. Falls back to null when
 * there is no detectable swing pivot to anchor to.
 */
export function calculateAnchoredVwap(candles: Candle[]): AnchoredVwapResult | null {
  const { highs, lows } = findSwingPoints(candles);
  const mostRecentPivot = [...highs, ...lows].sort((a, b) => b.index - a.index)[0];
  if (!mostRecentPivot) return null;

  const window = candles.slice(mostRecentPivot.index);
  if (window.length === 0) return null;

  let volumeSum = 0;
  let volumePriceSum = 0;
  for (const c of window) {
    const typicalPrice = (c.high + c.low + c.close) / 3;
    volumeSum += c.volume;
    volumePriceSum += typicalPrice * c.volume;
  }
  if (volumeSum === 0) return null;

  return { anchorIndex: mostRecentPivot.index, anchorPrice: mostRecentPivot.price, vwap: volumePriceSum / volumeSum };
}
