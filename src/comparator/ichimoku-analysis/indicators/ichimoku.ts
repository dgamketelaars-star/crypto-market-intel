/**
 * Ichimoku Kinko Hyo core line calculations, reimplemented from the
 * documented behaviour of pandas-ta-classic's `ichimoku()` (see
 * metadata/provenance.ts). Standard Hosoda periods, unchanged.
 */
export interface IchimokuCandle {
  high: number;
  low: number;
  close: number;
}

export const TENKAN_PERIOD = 9;
export const KIJUN_PERIOD = 26;
export const SENKOU_PERIOD = 52;
/** Conventionally equal to the Kijun period — used for both the forward cloud shift and the backward Chikou shift. */
export const DISPLACEMENT = KIJUN_PERIOD;

export interface IchimokuLines {
  tenkan: number | null;
  kijun: number | null;
  /** Senkou Span A "as displayed at this bar" — computed `DISPLACEMENT` bars ago, then projected forward. Null until enough history exists. */
  senkouA: number | null;
  /** Senkou Span B, same displacement logic as senkouA. */
  senkouB: number | null;
  /** Undisplaced Span A computed from data ending at THIS bar — what the cloud will show `DISPLACEMENT` bars from now. Uses only already-known data. */
  futureSenkouA: number | null;
  futureSenkouB: number | null;
}

function midpoint(candles: IchimokuCandle[], endIndexInclusive: number, length: number): number | null {
  const start = endIndexInclusive - length + 1;
  if (start < 0) return null;
  let hi = -Infinity;
  let lo = Infinity;
  for (let i = start; i <= endIndexInclusive; i++) {
    if (candles[i].high > hi) hi = candles[i].high;
    if (candles[i].low < lo) lo = candles[i].low;
  }
  return (hi + lo) / 2;
}

export function calculateIchimokuLines(candles: IchimokuCandle[], index: number): IchimokuLines {
  const tenkan = midpoint(candles, index, TENKAN_PERIOD);
  const kijun = midpoint(candles, index, KIJUN_PERIOD);

  const pastIndex = index - DISPLACEMENT;
  let senkouA: number | null = null;
  let senkouB: number | null = null;
  if (pastIndex >= 0) {
    const pastTenkan = midpoint(candles, pastIndex, TENKAN_PERIOD);
    const pastKijun = midpoint(candles, pastIndex, KIJUN_PERIOD);
    senkouA = pastTenkan != null && pastKijun != null ? (pastTenkan + pastKijun) / 2 : null;
    senkouB = midpoint(candles, pastIndex, SENKOU_PERIOD);
  }

  const futureSenkouA = tenkan != null && kijun != null ? (tenkan + kijun) / 2 : null;
  const futureSenkouB = midpoint(candles, index, SENKOU_PERIOD);

  return { tenkan, kijun, senkouA, senkouB, futureSenkouA, futureSenkouB };
}

export type ChikouReading = 'above' | 'below' | 'inside';

export interface ChikouResult {
  reading: ChikouReading | null;
  historicalCandle: IchimokuCandle | null;
}

/**
 * Chikou Span, reformulated for live (non-charting) evaluation. The
 * textbook definition plots today's close `DISPLACEMENT` bars in the PAST —
 * which, from today's perspective, is mathematically the same question as
 * "is the current close above or below the price that existed
 * `DISPLACEMENT` bars ago?". That reformulation needs no future data and is
 * exactly how Ichimoku traders read the Chikou line in real time, so it's
 * what this function computes — the literal `close.shift(-DISPLACEMENT)`
 * cannot be evaluated at the current bar without unknowable future closes.
 */
export function evaluateChikou(candles: IchimokuCandle[], index: number): ChikouResult {
  const pastIndex = index - DISPLACEMENT;
  if (pastIndex < 0) return { reading: null, historicalCandle: null };
  const currentClose = candles[index].close;
  const past = candles[pastIndex];
  if (currentClose > past.high) return { reading: 'above', historicalCandle: past };
  if (currentClose < past.low) return { reading: 'below', historicalCandle: past };
  return { reading: 'inside', historicalCandle: past };
}
