import { describe, expect, it } from 'vitest';
import { makeCandlesFromCloses, makeTrendingCloses } from '../testUtils/fixtures';
import { analyseTrend } from './trend';

describe('analyseTrend', () => {
  it('reports insufficient_data with too few candles', () => {
    const candles = makeCandlesFromCloses([1, 2, 3]);
    const result = analyseTrend(candles, '1h');
    expect(result.classification).toBe('insufficient_data');
    expect(result.sufficientData).toBe(false);
  });

  it('classifies a steady, meaningful uptrend as uptrend with bullish EMA alignment', () => {
    const closes = makeTrendingCloses(100, 0.6, 260);
    const result = analyseTrend(makeCandlesFromCloses(closes), '1h');
    expect(result.classification).toBe('uptrend');
    expect(result.emaAlignment).toBe('bullish');
  });

  it('classifies a steady downtrend as downtrend with bearish EMA alignment', () => {
    const closes = makeTrendingCloses(500, -0.6, 260);
    const result = analyseTrend(makeCandlesFromCloses(closes), '1h');
    expect(result.classification).toBe('downtrend');
    expect(result.emaAlignment).toBe('bearish');
  });

  it('classifies a flat series as sideways', () => {
    const closes = Array.from({ length: 260 }, (_, i) => 100 + Math.sin(i) * 0.0005);
    const result = analyseTrend(makeCandlesFromCloses(closes), '1h');
    expect(result.classification).toBe('sideways');
  });

  it('never leaks NaN/Infinity into its numeric fields', () => {
    const closes = makeTrendingCloses(100, 0.6, 260);
    const result = analyseTrend(makeCandlesFromCloses(closes), '1h');
    for (const value of [result.priceVsEma20Pct, result.priceVsEma50Pct, result.priceVsEma200Pct, result.emaSlope20Pct]) {
      if (value !== null) expect(Number.isFinite(value)).toBe(true);
    }
  });
});
