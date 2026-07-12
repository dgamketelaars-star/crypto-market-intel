import { describe, expect, it } from 'vitest';
import { calculateBollingerSeries, isBollingerSqueeze, latestBollinger } from './bollingerBands';

describe('calculateBollingerSeries', () => {
  it('returns null for every index before there is enough history', () => {
    expect(calculateBollingerSeries([1, 2, 3], 20)).toEqual([null, null, null]);
  });

  it('produces a flat band (width 0) for a perfectly constant series', () => {
    const closes = Array.from({ length: 25 }, () => 100);
    const point = latestBollinger(closes, 20, 2);
    expect(point).not.toBeNull();
    expect(point!.middle).toBe(100);
    expect(point!.upper).toBe(100);
    expect(point!.lower).toBe(100);
    expect(point!.widthPct).toBe(0);
  });

  it('widens the band as volatility increases', () => {
    const stable = [...Array.from({ length: 19 }, () => 100), 100];
    const volatile = [...Array.from({ length: 19 }, () => 100), 130];
    const stablePoint = latestBollinger(stable, 20, 2)!;
    const volatilePoint = latestBollinger(volatile, 20, 2)!;
    expect(volatilePoint.widthPct).toBeGreaterThan(stablePoint.widthPct);
  });

  it('upper band stays above lower band whenever both exist', () => {
    const closes = [10, 12, 9, 15, 11, 14, 13, 16, 10, 18, 17, 20, 15, 22, 19, 25, 18, 21, 16, 23, 24];
    for (const point of calculateBollingerSeries(closes, 20, 2)) {
      if (point === null) continue;
      expect(point.upper).toBeGreaterThanOrEqual(point.lower);
    }
  });
});

describe('isBollingerSqueeze', () => {
  it('returns false when there is not enough history', () => {
    expect(isBollingerSqueeze([0.1, 0.1, null], 60)).toBe(false);
  });

  it('flags the current width as a squeeze when it sits at the bottom of recent history', () => {
    const wide = Array.from({ length: 59 }, () => 0.2);
    const series = [...wide, 0.01];
    expect(isBollingerSqueeze(series, 60)).toBe(true);
  });

  it('does not flag a squeeze when the current width sits above the recent-history threshold', () => {
    const series = Array.from({ length: 60 }, (_, i) => 0.1 + (i % 10) * 0.01);
    expect(isBollingerSqueeze(series, 60)).toBe(false);
  });
});
