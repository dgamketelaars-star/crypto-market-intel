/** Rate of change: % move over `period` candles. */
export function calculateRocSeries(closes: number[], period = 10): (number | null)[] {
  return closes.map((c, i) => {
    if (i < period) return null;
    const past = closes[i - period];
    if (past === 0) return null;
    return ((c - past) / past) * 100;
  });
}

export function latestRoc(closes: number[], period = 10): number | null {
  const series = calculateRocSeries(closes, period);
  return series[series.length - 1] ?? null;
}
