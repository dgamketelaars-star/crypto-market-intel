import { describe, expect, it } from 'vitest';
import { calculateEmaSeries, latestEma } from './ema';

describe('calculateEmaSeries', () => {
  it('returns null for every index before there is enough history', () => {
    expect(calculateEmaSeries([1, 2, 3], 5)).toEqual([null, null, null]);
  });

  it('seeds with an SMA and matches a hand-computed EMA(3) sequence', () => {
    // closes: 1,2,3,4,5,6 ; period 3 ; k = 2/(3+1) = 0.5
    // SMA(1,2,3) = 2 -> seed at index 2
    // ema[3] = 4*0.5 + 2*0.5 = 3 ; ema[4] = 5*0.5+3*0.5 = 4 ; ema[5] = 6*0.5+4*0.5 = 5
    const series = calculateEmaSeries([1, 2, 3, 4, 5, 6], 3);
    expect(series[0]).toBeNull();
    expect(series[1]).toBeNull();
    expect(series[2]).toBeCloseTo(2);
    expect(series[3]).toBeCloseTo(3);
    expect(series[4]).toBeCloseTo(4);
    expect(series[5]).toBeCloseTo(5);
  });

  it('handles an empty input array without throwing', () => {
    expect(calculateEmaSeries([], 20)).toEqual([]);
  });

  it('latestEma returns null when there is not enough data', () => {
    expect(latestEma([1, 2], 10)).toBeNull();
  });

  it('latestEma matches the last entry of the series', () => {
    const values = Array.from({ length: 30 }, (_, i) => 100 + i);
    expect(latestEma(values, 20)).toBeCloseTo(calculateEmaSeries(values, 20).at(-1)!);
  });
});
