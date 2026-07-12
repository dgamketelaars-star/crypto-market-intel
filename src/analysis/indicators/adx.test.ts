import { describe, expect, it } from 'vitest';
import { calculateAdxSeries, latestAdx } from './adx';
import type { OhlcLike } from './atr';

function candle(high: number, low: number, close: number): OhlcLike {
  return { high, low, close };
}

describe('calculateAdxSeries', () => {
  it('returns null for every index before there is enough history', () => {
    const candles = Array.from({ length: 10 }, (_, i) => candle(101 + i, 99 + i, 100 + i));
    expect(calculateAdxSeries(candles, 14).every((v) => v === null)).toBe(true);
  });

  it('reports high ADX with dominant +DI for a strong, consistent uptrend', () => {
    const candles = Array.from({ length: 60 }, (_, i) => candle(100 + i * 2 + 1, 100 + i * 2 - 1, 100 + i * 2));
    const point = latestAdx(candles, 14);
    expect(point).not.toBeNull();
    expect(point!.plusDi).toBeGreaterThan(point!.minusDi);
    expect(point!.adx).toBeGreaterThan(20);
  });

  it('reports low ADX for a flat, directionless market', () => {
    const candles = Array.from({ length: 60 }, (_, i) => {
      const wiggle = i % 2 === 0 ? 0.5 : -0.5;
      return candle(100 + wiggle + 0.2, 100 + wiggle - 0.2, 100 + wiggle);
    });
    const point = latestAdx(candles, 14);
    expect(point).not.toBeNull();
    expect(point!.adx).toBeLessThan(20);
  });

  it('keeps ADX and DI values finite and non-negative', () => {
    const candles = [10, 12, 9, 15, 11, 14, 13, 16, 10, 18, 17, 20, 15, 22, 19, 25, 18, 21, 16, 23, 24, 20, 22, 19, 26, 21, 23, 18, 25, 22].map(
      (c) => candle(c + 1, c - 1, c),
    );
    for (const point of calculateAdxSeries(candles, 14)) {
      if (point === null) continue;
      expect(Number.isFinite(point.adx)).toBe(true);
      expect(point.adx).toBeGreaterThanOrEqual(0);
      expect(point.plusDi).toBeGreaterThanOrEqual(0);
      expect(point.minusDi).toBeGreaterThanOrEqual(0);
    }
  });

  it('latestAdx matches the last entry of the series', () => {
    const candles = Array.from({ length: 60 }, (_, i) => candle(100 + i * 1.5 + 1, 100 + i * 1.5 - 1, 100 + i * 1.5));
    const series = calculateAdxSeries(candles, 14);
    expect(latestAdx(candles, 14)).toEqual(series.at(-1));
  });
});
