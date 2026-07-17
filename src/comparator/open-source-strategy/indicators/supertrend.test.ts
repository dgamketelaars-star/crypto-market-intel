import { describe, expect, it } from 'vitest';
import { makeCandlesFromCloses, makeTrendingCloses } from '../../../analysis/testUtils/fixtures';
import { calculateSupertrendSeries, latestSupertrend } from './supertrend';

describe('calculateSupertrendSeries', () => {
  it('returns null value/direction before the warmup period elapses', () => {
    const candles = makeCandlesFromCloses(makeTrendingCloses(100, 1, 5));
    const series = calculateSupertrendSeries(candles, 3, 10);
    expect(series.every((p) => p.value === null && p.direction === null)).toBe(true);
  });

  it('reads "up" once a sustained uptrend has run past warmup', () => {
    const candles = makeCandlesFromCloses(makeTrendingCloses(100, 2, 60));
    const point = latestSupertrend(candles, 3, 10);
    expect(point.direction).toBe('up');
  });

  it('reads "down" once a sustained downtrend has run past warmup', () => {
    const candles = makeCandlesFromCloses(makeTrendingCloses(300, -2, 60));
    const point = latestSupertrend(candles, 3, 10);
    expect(point.direction).toBe('down');
  });
});
