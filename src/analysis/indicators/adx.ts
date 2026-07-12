import type { OhlcLike } from './atr';
import { calculateTrueRangeSeries } from './atr';

export interface AdxPoint {
  adx: number;
  plusDi: number;
  minusDi: number;
}

/** Wilder's running-sum smoothing: sum[i] = sum[i-1] - sum[i-1]/period + values[i], seeded by a plain sum of the first `period` values. */
function wilderSmoothedSum(values: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return result;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  result[period - 1] = sum;
  for (let i = period; i < values.length; i++) {
    const prev = result[i - 1] as number;
    result[i] = prev - prev / period + values[i];
  }
  return result;
}

/**
 * Wilder's ADX(14) with directional indicators. +DI/-DI measure which side
 * is winning; ADX itself measures trend *strength* regardless of direction
 * (a low ADX means "no real trend either way", not "bearish").
 */
export function calculateAdxSeries(candles: OhlcLike[], period = 14): (AdxPoint | null)[] {
  const result: (AdxPoint | null)[] = new Array(candles.length).fill(null);
  if (candles.length < period * 2) return result;

  const tr = calculateTrueRangeSeries(candles);
  const plusDm: number[] = [0];
  const minusDm: number[] = [0];
  for (let i = 1; i < candles.length; i++) {
    const upMove = candles[i].high - candles[i - 1].high;
    const downMove = candles[i - 1].low - candles[i].low;
    plusDm.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDm.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  const smoothedTr = wilderSmoothedSum(tr, period);
  const smoothedPlusDm = wilderSmoothedSum(plusDm, period);
  const smoothedMinusDm = wilderSmoothedSum(minusDm, period);

  // +DI/-DI/DX from index `period - 1` onward — the ratios are scale-invariant, so using the
  // Wilder running *sums* directly (instead of dividing them down to averages first) is exact.
  const di: ({ plusDi: number; minusDi: number } | null)[] = new Array(candles.length).fill(null);
  const dx: (number | null)[] = new Array(candles.length).fill(null);
  for (let i = period - 1; i < candles.length; i++) {
    const trVal = smoothedTr[i];
    const plusVal = smoothedPlusDm[i];
    const minusVal = smoothedMinusDm[i];
    if (trVal === null || plusVal === null || minusVal === null || trVal === 0) continue;
    const plusDi = (100 * plusVal) / trVal;
    const minusDi = (100 * minusVal) / trVal;
    di[i] = { plusDi, minusDi };
    const diSum = plusDi + minusDi;
    dx[i] = diSum === 0 ? 0 : (100 * Math.abs(plusDi - minusDi)) / diSum;
  }

  const firstDxIndex = dx.findIndex((v) => v !== null);
  if (firstDxIndex === -1) return result;
  const validDx = dx.slice(firstDxIndex).filter((v): v is number => v !== null);
  // Dividing every element of the Wilder running sum by `period` yields the correct running
  // *average* at every step, not just the first — see derivation in the Phase 1 report.
  const adxSeries = wilderSmoothedSum(validDx, period).map((v) => (v === null ? null : v / period));

  for (let i = 0; i < adxSeries.length; i++) {
    const adx = adxSeries[i];
    const point = di[firstDxIndex + i];
    if (adx === null || !point) continue;
    result[firstDxIndex + i] = { adx, plusDi: point.plusDi, minusDi: point.minusDi };
  }

  return result;
}

export function latestAdx(candles: OhlcLike[], period = 14): AdxPoint | null {
  const series = calculateAdxSeries(candles, period);
  return series[series.length - 1] ?? null;
}
