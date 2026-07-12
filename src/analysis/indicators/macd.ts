import { calculateEmaSeries } from './ema';

export interface MacdPoint {
  macdLine: number;
  signalLine: number;
  histogram: number;
}

/** Standard MACD(12, 26, 9): fast EMA minus slow EMA, smoothed by a signal EMA. */
export function calculateMacdSeries(closes: number[], fast = 12, slow = 26, signal = 9): (MacdPoint | null)[] {
  const result: (MacdPoint | null)[] = new Array(closes.length).fill(null);
  if (closes.length < slow + signal) return result;

  const emaFast = calculateEmaSeries(closes, fast);
  const emaSlow = calculateEmaSeries(closes, slow);
  const macdLineSeries: (number | null)[] = closes.map((_, i) => {
    const f = emaFast[i];
    const s = emaSlow[i];
    return f !== null && s !== null ? f - s : null;
  });

  const firstValidIndex = macdLineSeries.findIndex((v) => v !== null);
  if (firstValidIndex === -1) return result;

  const validMacd = macdLineSeries.slice(firstValidIndex) as number[];
  const signalSeries = calculateEmaSeries(validMacd, signal);

  for (let i = 0; i < signalSeries.length; i++) {
    const sig = signalSeries[i];
    if (sig === null) continue;
    const macdLine = validMacd[i];
    result[firstValidIndex + i] = { macdLine, signalLine: sig, histogram: macdLine - sig };
  }
  return result;
}

export function latestMacd(closes: number[], fast = 12, slow = 26, signal = 9): MacdPoint | null {
  const series = calculateMacdSeries(closes, fast, slow, signal);
  return series[series.length - 1] ?? null;
}
