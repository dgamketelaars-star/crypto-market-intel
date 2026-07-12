/**
 * Exponential moving average. Seeded with a plain SMA over the first
 * `period` values (the conventional approach), then smoothed forward.
 * Returns `null` for every index before the series has enough history.
 */
export function calculateEmaSeries(values: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return result;

  const k = 2 / (period + 1);
  let sma = 0;
  for (let i = 0; i < period; i++) sma += values[i];
  sma /= period;
  result[period - 1] = sma;

  let prevEma = sma;
  for (let i = period; i < values.length; i++) {
    const ema = values[i] * k + prevEma * (1 - k);
    result[i] = ema;
    prevEma = ema;
  }
  return result;
}

export function latestEma(values: number[], period: number): number | null {
  const series = calculateEmaSeries(values, period);
  return series[series.length - 1] ?? null;
}
