import { describe, expect, it } from 'vitest';
import { calculateIchimokuLines, evaluateChikou, DISPLACEMENT, KIJUN_PERIOD, SENKOU_PERIOD, TENKAN_PERIOD, type IchimokuCandle } from './ichimoku';

function flatCandles(length: number, level = 100, range = 2): IchimokuCandle[] {
  return Array.from({ length }, () => ({ high: level + range, low: level - range, close: level }));
}

function risingCandles(length: number, start = 100, step = 1): IchimokuCandle[] {
  return Array.from({ length }, (_, i) => ({ high: start + i * step + 1, low: start + i * step - 1, close: start + i * step }));
}

describe('calculateIchimokuLines', () => {
  it('returns null for every line before enough history exists', () => {
    const candles = flatCandles(10);
    const lines = calculateIchimokuLines(candles, 5);
    expect(lines.tenkan).toBeNull();
    expect(lines.kijun).toBeNull();
    expect(lines.senkouA).toBeNull();
  });

  it('computes tenkan/kijun as the midpoint of the highest high and lowest low over the period, on flat data', () => {
    const candles = flatCandles(SENKOU_PERIOD + DISPLACEMENT + 5, 100, 2);
    const lines = calculateIchimokuLines(candles, candles.length - 1);
    expect(lines.tenkan).toBe(100);
    expect(lines.kijun).toBe(100);
    expect(lines.senkouA).toBe(100);
    expect(lines.senkouB).toBe(100);
  });

  it('produces senkouA (needs only the Kijun-period lookback at the displaced index) before senkouB (needs the full Senkou-period lookback)', () => {
    const candles = risingCandles(SENKOU_PERIOD + DISPLACEMENT + 10);
    // pastIndex = index - DISPLACEMENT sits far enough back for kijun's 26-lookback but not yet for senkouB's 52-lookback.
    const index = DISPLACEMENT + KIJUN_PERIOD + 5;
    const lines = calculateIchimokuLines(candles, index);
    expect(lines.futureSenkouA).not.toBeNull();
    expect(lines.futureSenkouB).not.toBeNull();
    expect(lines.senkouA).not.toBeNull();
    expect(lines.senkouB).toBeNull();
  });

  it('produces senkouB only once the displaced index also has a full Senkou-period lookback available', () => {
    const candles = risingCandles(SENKOU_PERIOD + DISPLACEMENT + 10);
    const index = DISPLACEMENT + SENKOU_PERIOD - 1;
    const lines = calculateIchimokuLines(candles, index);
    expect(lines.senkouB).not.toBeNull();
  });

  it('displaces senkouA/B forward: the value at index i equals the undisplaced (future) span computed at index i - DISPLACEMENT', () => {
    const candles = risingCandles(SENKOU_PERIOD + DISPLACEMENT + 20);
    const laterIndex = candles.length - 1;
    const earlierIndex = laterIndex - DISPLACEMENT;

    const later = calculateIchimokuLines(candles, laterIndex);
    const earlier = calculateIchimokuLines(candles, earlierIndex);

    expect(later.senkouA).toBeCloseTo(earlier.futureSenkouA!, 6);
    expect(later.senkouB).toBeCloseTo(earlier.futureSenkouB!, 6);
  });

  it('tenkan reacts faster than kijun to a recent price move (shorter lookback)', () => {
    // Long flat baseline, then a rally long enough to fill tenkan's whole 9-candle window (so none of
    // that window still touches the flat baseline) but short enough that kijun's 26-candle window still
    // reaches back into it — tenkan's midpoint should then sit above kijun's.
    const flatRun = flatCandles(SENKOU_PERIOD, 100, 1);
    const rallyLength = TENKAN_PERIOD + 3;
    const rally: IchimokuCandle[] = Array.from({ length: rallyLength }, (_, i) => {
      const level = 150 + i * 5;
      return { high: level + 1, low: level - 1, close: level };
    });
    const candles = [...flatRun, ...rally];
    const lines = calculateIchimokuLines(candles, candles.length - 1);
    expect(lines.tenkan!).toBeGreaterThan(lines.kijun!);
  });
});

describe('evaluateChikou', () => {
  it('returns a null reading when fewer than DISPLACEMENT candles of history exist', () => {
    const candles = flatCandles(10);
    expect(evaluateChikou(candles, 5).reading).toBeNull();
  });

  it('reads "above" when the current close exceeds the high from DISPLACEMENT candles ago', () => {
    const candles = risingCandles(DISPLACEMENT + 5, 100, 3);
    const result = evaluateChikou(candles, candles.length - 1);
    expect(result.reading).toBe('above');
    expect(result.historicalCandle).toEqual(candles[candles.length - 1 - DISPLACEMENT]);
  });

  it('reads "below" when the current close is under the low from DISPLACEMENT candles ago', () => {
    const candles = risingCandles(DISPLACEMENT + 5, 100, -3);
    const result = evaluateChikou(candles, candles.length - 1);
    expect(result.reading).toBe('below');
  });

  it('reads "inside" when the current close sits within the historical candle\'s range', () => {
    const candles = flatCandles(DISPLACEMENT + 5, 100, 5);
    const result = evaluateChikou(candles, candles.length - 1);
    expect(result.reading).toBe('inside');
  });
});
