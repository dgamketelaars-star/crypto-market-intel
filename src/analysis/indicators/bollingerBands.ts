import { calculateSmaSeries } from './sma';

export interface BollingerPoint {
  middle: number;
  upper: number;
  lower: number;
  /** Band width as a fraction of the middle band — the standard normalized squeeze metric. */
  widthPct: number;
}

/** Standard Bollinger Bands: SMA(period) +/- stdDevMult * population stddev over the same window. */
export function calculateBollingerSeries(closes: number[], period = 20, stdDevMult = 2): (BollingerPoint | null)[] {
  const result: (BollingerPoint | null)[] = new Array(closes.length).fill(null);
  if (period <= 0 || closes.length < period) return result;

  const middleSeries = calculateSmaSeries(closes, period);
  for (let i = period - 1; i < closes.length; i++) {
    const middle = middleSeries[i];
    if (middle === null) continue;
    const window = closes.slice(i - period + 1, i + 1);
    const variance = window.reduce((sum, v) => sum + (v - middle) ** 2, 0) / period;
    const stdDev = Math.sqrt(variance);
    const upper = middle + stdDevMult * stdDev;
    const lower = middle - stdDevMult * stdDev;
    result[i] = { middle, upper, lower, widthPct: middle !== 0 ? (upper - lower) / middle : 0 };
  }
  return result;
}

export function latestBollinger(closes: number[], period = 20, stdDevMult = 2): BollingerPoint | null {
  const series = calculateBollingerSeries(closes, period, stdDevMult);
  return series[series.length - 1] ?? null;
}

/**
 * A window is "squeezing" when its band width sits in the bottom fraction of
 * its own recent history — relative to itself, not an arbitrary absolute
 * cutoff, since normal width varies a lot by symbol and timeframe.
 */
export function isBollingerSqueeze(widthSeries: (number | null)[], lookback = 60, percentile = 0.2): boolean {
  const recent = widthSeries.slice(-lookback).filter((w): w is number => w !== null);
  if (recent.length < lookback / 2) return false;
  const current = recent[recent.length - 1];
  const sorted = [...recent].sort((a, b) => a - b);
  const threshold = sorted[Math.floor(sorted.length * percentile)];
  return current <= threshold;
}
