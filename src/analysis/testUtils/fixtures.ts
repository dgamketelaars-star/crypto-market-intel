import type { Candle } from '../../services/binance/types';

export function makeCandle(overrides: Partial<Candle> & { close: number }, index = 0): Candle {
  const close = overrides.close;
  const open = overrides.open ?? close;
  const high = overrides.high ?? Math.max(open, close);
  const low = overrides.low ?? Math.min(open, close);
  const openTime = overrides.openTime ?? index * 60 * 60_000;
  const closeTime = overrides.closeTime ?? openTime + 60 * 60_000 - 1;
  return {
    openTime,
    closeTime,
    open,
    high,
    low,
    close,
    volume: overrides.volume ?? 100,
    isFinal: overrides.isFinal ?? true,
  };
}

export function makeCandlesFromCloses(
  closes: number[],
  opts: { volume?: number | number[]; intervalMs?: number } = {},
): Candle[] {
  const intervalMs = opts.intervalMs ?? 60 * 60_000;
  return closes.map((close, i) => {
    const volume = Array.isArray(opts.volume) ? opts.volume[i] : (opts.volume ?? 100);
    return makeCandle({ close, volume, openTime: i * intervalMs, closeTime: i * intervalMs + intervalMs - 1 }, i);
  });
}

/** A steady linear series, e.g. start=100, step=0.6, n=260 candles. */
export function makeTrendingCloses(start: number, step: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => start + step * i);
}

/**
 * Alternating pivots connected by strictly monotonic ramps, so each interior
 * pivot is a guaranteed local extreme within a small window (no flat/tied
 * segments, which would make swing detection ambiguous at the window edge).
 * `pivots[0]` is only an entry point for the first ramp's direction — it is
 * never itself detectable (index 0 is always outside the swing-lookback
 * window) — and the final pivot is a monotonic trailing buffer, also never
 * meant to be detected.
 */
export function zigzagCandles(pivots: number[], segment = 4): Candle[] {
  const closes: number[] = [];
  for (let p = 0; p < pivots.length - 1; p++) {
    const from = pivots[p];
    const to = pivots[p + 1];
    for (let s = 0; s < segment; s++) closes.push(from + ((to - from) * s) / segment);
  }
  closes.push(pivots[pivots.length - 1]);
  return closes.map((close, i) => makeCandle({ close, high: close + 0.05, low: close - 0.05 }, i));
}
