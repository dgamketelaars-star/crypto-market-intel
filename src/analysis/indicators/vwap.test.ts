import { describe, expect, it } from 'vitest';
import { calculateVwapSeries, latestVwap } from './vwap';

describe('calculateVwapSeries', () => {
  it('returns null for every index before there is enough history', () => {
    const candles = Array.from({ length: 5 }, () => ({ high: 101, low: 99, close: 100, volume: 10 }));
    expect(calculateVwapSeries(candles, 20).every((v) => v === null)).toBe(true);
  });

  it('equals the constant typical price when price and volume never change', () => {
    const candles = Array.from({ length: 20 }, () => ({ high: 102, low: 98, close: 100, volume: 10 }));
    expect(latestVwap(candles, 20)).toBeCloseTo(100);
  });

  it('weights higher-volume candles more heavily than low-volume ones', () => {
    const candles = [
      ...Array.from({ length: 19 }, () => ({ high: 101, low: 99, close: 100, volume: 1 })),
      { high: 201, low: 199, close: 200, volume: 1000 },
    ];
    // 19 candles at typical price 100 (volume 1 each) vs. 1 candle at typical price 200 (volume 1000):
    // the single high-volume candle should pull VWAP far closer to 200 than a plain average (150) would.
    expect(latestVwap(candles, 20)).toBeGreaterThan(190);
  });

  it('returns null when total volume in the window is zero', () => {
    const candles = Array.from({ length: 20 }, () => ({ high: 101, low: 99, close: 100, volume: 0 }));
    expect(latestVwap(candles, 20)).toBeNull();
  });
});
