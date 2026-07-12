import type { OhlcLike } from './atr';
import { calculateSmaSeries } from './sma';

export interface StochasticPoint {
  percentK: number;
  percentD: number;
}

/** Standard slow stochastic: %K over `kPeriod`, %D is an `dPeriod`-SMA of %K. */
export function calculateStochasticSeries(candles: OhlcLike[], kPeriod = 14, dPeriod = 3): (StochasticPoint | null)[] {
  const result: (StochasticPoint | null)[] = new Array(candles.length).fill(null);
  if (candles.length < kPeriod) return result;

  const percentKSeries: (number | null)[] = new Array(candles.length).fill(null);
  for (let i = kPeriod - 1; i < candles.length; i++) {
    const window = candles.slice(i - kPeriod + 1, i + 1);
    const highest = Math.max(...window.map((c) => c.high));
    const lowest = Math.min(...window.map((c) => c.low));
    const range = highest - lowest;
    percentKSeries[i] = range === 0 ? 50 : (100 * (candles[i].close - lowest)) / range;
  }

  const firstKIndex = percentKSeries.findIndex((v) => v !== null);
  if (firstKIndex === -1) return result;
  const validK = percentKSeries.slice(firstKIndex).filter((v): v is number => v !== null);
  const percentDSeries = calculateSmaSeries(validK, dPeriod);

  for (let i = 0; i < percentDSeries.length; i++) {
    const d = percentDSeries[i];
    if (d === null) continue;
    result[firstKIndex + i] = { percentK: validK[i], percentD: d };
  }
  return result;
}

export function latestStochastic(candles: OhlcLike[], kPeriod = 14, dPeriod = 3): StochasticPoint | null {
  const series = calculateStochasticSeries(candles, kPeriod, dPeriod);
  return series[series.length - 1] ?? null;
}
