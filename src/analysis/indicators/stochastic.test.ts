import { describe, expect, it } from 'vitest';
import { calculateStochasticSeries, latestStochastic } from './stochastic';
import type { OhlcLike } from './atr';

function candle(high: number, low: number, close: number): OhlcLike {
  return { high, low, close };
}

describe('calculateStochasticSeries', () => {
  it('returns null for every index before there is enough history', () => {
    const candles = Array.from({ length: 5 }, (_, i) => candle(101 + i, 99 + i, 100 + i));
    expect(calculateStochasticSeries(candles, 14, 3).every((v) => v === null)).toBe(true);
  });

  it('reads near 100 when the close sits at the top of its recent range', () => {
    const candles = Array.from({ length: 20 }, (_, i) => candle(100 + i, 90, 100 + i));
    const point = latestStochastic(candles, 14, 3);
    expect(point).not.toBeNull();
    expect(point!.percentK).toBeCloseTo(100);
  });

  it('reads near 0 when the close sits at the bottom of its recent range', () => {
    const candles = Array.from({ length: 20 }, (_, i) => candle(110, 100 - i, 100 - i));
    const point = latestStochastic(candles, 14, 3);
    expect(point).not.toBeNull();
    expect(point!.percentK).toBeCloseTo(0);
  });

  it('returns 50 when high equals low (zero range) instead of dividing by zero', () => {
    const candles = Array.from({ length: 20 }, () => candle(100, 100, 100));
    const point = latestStochastic(candles, 14, 3);
    expect(point!.percentK).toBe(50);
    expect(Number.isFinite(point!.percentD)).toBe(true);
  });

  it('keeps %K and %D within [0, 100] for mixed data', () => {
    const closes = [10, 12, 9, 15, 11, 14, 13, 16, 10, 18, 17, 20, 15, 22, 19, 25, 18, 21, 16, 23, 24];
    const candles = closes.map((c) => candle(c + 1, c - 1, c));
    for (const point of calculateStochasticSeries(candles, 14, 3)) {
      if (point === null) continue;
      expect(point.percentK).toBeGreaterThanOrEqual(0);
      expect(point.percentK).toBeLessThanOrEqual(100);
      expect(point.percentD).toBeGreaterThanOrEqual(0);
      expect(point.percentD).toBeLessThanOrEqual(100);
    }
  });
});
