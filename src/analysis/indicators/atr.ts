export interface OhlcLike {
  high: number;
  low: number;
  close: number;
}

export function calculateTrueRangeSeries(candles: OhlcLike[]): number[] {
  return candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const prevClose = candles[i - 1].close;
    return Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose));
  });
}

/** Wilder's ATR: seeded with a plain average of the first `period` true ranges. */
export function calculateAtrSeries(candles: OhlcLike[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(candles.length).fill(null);
  if (candles.length < period) return result;

  const tr = calculateTrueRangeSeries(candles);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += tr[i];
  let atr = sum / period;
  result[period - 1] = atr;

  for (let i = period; i < tr.length; i++) {
    atr = (atr * (period - 1) + tr[i]) / period;
    result[i] = atr;
  }
  return result;
}

export function latestAtr(candles: OhlcLike[], period = 14): number | null {
  const series = calculateAtrSeries(candles, period);
  return series[series.length - 1] ?? null;
}
