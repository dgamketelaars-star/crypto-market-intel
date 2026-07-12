import { describe, expect, it } from 'vitest';
import { calculateSmaSeries, latestSma } from './sma';

describe('calculateSmaSeries', () => {
  it('returns null for every index before there is enough history', () => {
    expect(calculateSmaSeries([1, 2, 3], 5)).toEqual([null, null, null]);
  });

  it('matches a hand-computed SMA(3) sequence', () => {
    const series = calculateSmaSeries([1, 2, 3, 4, 5, 6], 3);
    expect(series).toEqual([null, null, 2, 3, 4, 5]);
  });

  it('handles an empty input array without throwing', () => {
    expect(calculateSmaSeries([], 20)).toEqual([]);
  });

  it('latestSma returns null when there is not enough data', () => {
    expect(latestSma([1, 2], 10)).toBeNull();
  });

  it('latestSma matches the last entry of the series', () => {
    const values = Array.from({ length: 30 }, (_, i) => 100 + i);
    expect(latestSma(values, 20)).toBeCloseTo(calculateSmaSeries(values, 20).at(-1)!);
  });
});
