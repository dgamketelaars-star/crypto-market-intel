export interface ObvCandleLike {
  close: number;
  volume: number;
}

/** On-balance volume: running total, adding volume on an up close and subtracting on a down close. */
export function calculateObvSeries(candles: ObvCandleLike[]): number[] {
  const result: number[] = new Array(candles.length).fill(0);
  for (let i = 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change > 0) result[i] = result[i - 1] + candles[i].volume;
    else if (change < 0) result[i] = result[i - 1] - candles[i].volume;
    else result[i] = result[i - 1];
  }
  return result;
}

/**
 * OBV's own value is meaningless in isolation (it's a running total, not a
 * bounded oscillator) — only its slope over a lookback window matters.
 */
export function calculateObvSlope(obvSeries: number[], lookback = 20): number | null {
  if (obvSeries.length < lookback + 1) return null;
  const from = obvSeries[obvSeries.length - 1 - lookback];
  const to = obvSeries[obvSeries.length - 1];
  return to - from;
}

export function latestObv(candles: ObvCandleLike[]): number | null {
  if (candles.length === 0) return null;
  const series = calculateObvSeries(candles);
  return series[series.length - 1];
}
