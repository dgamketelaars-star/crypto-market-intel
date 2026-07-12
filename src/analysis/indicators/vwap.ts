export interface VwapCandleLike {
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Rolling VWAP over the last `period` candles. Crypto futures trade 24/7 —
 * there is no exchange session to anchor to — so this is a rolling window
 * rather than a session-anchored VWAP, consistent with how ATR/EMA/etc. are
 * already computed as rolling windows in this codebase.
 */
export function calculateVwapSeries(candles: VwapCandleLike[], period = 20): (number | null)[] {
  const result: (number | null)[] = new Array(candles.length).fill(null);
  if (period <= 0 || candles.length < period) return result;

  for (let i = period - 1; i < candles.length; i++) {
    const window = candles.slice(i - period + 1, i + 1);
    let volumeSum = 0;
    let volumePriceSum = 0;
    for (const c of window) {
      const typicalPrice = (c.high + c.low + c.close) / 3;
      volumeSum += c.volume;
      volumePriceSum += typicalPrice * c.volume;
    }
    result[i] = volumeSum === 0 ? null : volumePriceSum / volumeSum;
  }
  return result;
}

export function latestVwap(candles: VwapCandleLike[], period = 20): number | null {
  const series = calculateVwapSeries(candles, period);
  return series[series.length - 1] ?? null;
}
