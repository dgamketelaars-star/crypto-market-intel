import { describe, expect, it } from 'vitest';
import { makeCandlesFromCloses, makeTrendingCloses } from '../../../analysis/testUtils/fixtures';
import { calculateTripleConfirmationSeries, latestTripleConfirmation } from './tripleConfirmation';

describe('calculateTripleConfirmationSeries', () => {
  it('fires enterLong once all 3 buy-parameter Supertrend instances agree "up" with volume', () => {
    const candles = makeCandlesFromCloses(makeTrendingCloses(100, 2, 80), { volume: 50 });
    const point = latestTripleConfirmation(candles)!;
    expect(point.buy.every((p) => p.direction === 'up')).toBe(true);
    expect(point.enterLong).toBe(true);
    expect(point.enterShort).toBe(false);
  });

  it('fires enterShort once all 3 sell-parameter Supertrend instances agree "down" with volume', () => {
    const candles = makeCandlesFromCloses(makeTrendingCloses(400, -2, 80), { volume: 50 });
    const point = latestTripleConfirmation(candles)!;
    expect(point.sell.every((p) => p.direction === 'down')).toBe(true);
    expect(point.enterShort).toBe(true);
    expect(point.enterLong).toBe(false);
  });

  it('never fires entries when volume is zero, even if the Supertrend instances agree', () => {
    const candles = makeCandlesFromCloses(makeTrendingCloses(100, 2, 80), { volume: 0 });
    const point = latestTripleConfirmation(candles)!;
    expect(point.enterLong).toBe(false);
    expect(point.enterShort).toBe(false);
  });

  it('returns null for an empty candle set', () => {
    expect(latestTripleConfirmation([])).toBeNull();
  });

  it('every element carries a well-formed buy/sell tuple of length 3', () => {
    const candles = makeCandlesFromCloses(makeTrendingCloses(100, 1, 30), { volume: 20 });
    const series = calculateTripleConfirmationSeries(candles);
    expect(series).toHaveLength(candles.length);
    expect(series.every((p) => p.buy.length === 3 && p.sell.length === 3)).toBe(true);
  });
});
