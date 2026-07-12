import type { Candle } from '../../services/binance/types';
import { calculateAtrSeries } from '../indicators/atr';
import { RULES } from '../engine/rules';

export interface CompressionResult {
  rangeCompression: boolean;
  expansionAfterCompression: boolean;
  sufficientData: boolean;
}

function average(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Compares ATR% across three consecutive windows (long baseline → mid → most
 * recent) to detect a tightening range, and a tightened range that has just
 * started expanding again.
 */
export function analyseCompression(candles: Candle[]): CompressionResult {
  const shortWindow = 3;
  const midWindow = RULES.structure.compressionLookback;
  const longWindow = RULES.structure.compressionLookback;
  const needed = shortWindow + midWindow + longWindow + 14;

  if (candles.length < needed) {
    return { rangeCompression: false, expansionAfterCompression: false, sufficientData: false };
  }

  const atrSeries = calculateAtrSeries(candles, 14);
  const atrPct: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    const atr = atrSeries[i];
    if (atr !== null && candles[i].close > 0) atrPct.push((atr / candles[i].close) * 100);
  }
  if (atrPct.length < shortWindow + midWindow + longWindow) {
    return { rangeCompression: false, expansionAfterCompression: false, sufficientData: false };
  }

  const recent = atrPct.slice(-shortWindow);
  const mid = atrPct.slice(-shortWindow - midWindow, -shortWindow);
  const long = atrPct.slice(-shortWindow - midWindow - longWindow, -shortWindow - midWindow);

  const avgRecent = average(recent);
  const avgMid = average(mid);
  const avgLong = average(long);

  const rangeCompression = avgMid > 0 && avgRecent / avgMid <= RULES.structure.compressionRatio;
  const midWasCompressedVsLong = avgLong > 0 && avgMid / avgLong <= RULES.structure.compressionRatio;
  const expansionAfterCompression =
    midWasCompressedVsLong && avgMid > 0 && avgRecent / avgMid >= 1 / RULES.structure.compressionRatio;

  return { rangeCompression, expansionAfterCompression, sufficientData: true };
}
