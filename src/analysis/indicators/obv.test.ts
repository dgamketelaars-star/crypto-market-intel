import { describe, expect, it } from 'vitest';
import { calculateObvSeries, calculateObvSlope, latestObv } from './obv';

describe('calculateObvSeries', () => {
  it('starts at 0 for the first candle', () => {
    const series = calculateObvSeries([{ close: 100, volume: 50 }]);
    expect(series).toEqual([0]);
  });

  it('adds volume on an up close and subtracts on a down close', () => {
    const candles = [
      { close: 100, volume: 10 },
      { close: 105, volume: 20 }, // up -> +20
      { close: 102, volume: 5 }, // down -> -5
      { close: 102, volume: 7 }, // flat -> unchanged
    ];
    expect(calculateObvSeries(candles)).toEqual([0, 20, 15, 15]);
  });

  it('handles an empty input array without throwing', () => {
    expect(calculateObvSeries([])).toEqual([]);
  });
});

describe('calculateObvSlope', () => {
  it('returns null when there is not enough history for the lookback', () => {
    expect(calculateObvSlope([0, 10, 20], 20)).toBeNull();
  });

  it('returns the change in OBV over the lookback window', () => {
    const series = Array.from({ length: 25 }, (_, i) => i * 10);
    expect(calculateObvSlope(series, 20)).toBe(200);
  });
});

describe('latestObv', () => {
  it('returns null for an empty candle array', () => {
    expect(latestObv([])).toBeNull();
  });

  it('matches the last entry of the series', () => {
    const candles = [
      { close: 100, volume: 10 },
      { close: 105, volume: 20 },
      { close: 103, volume: 5 },
    ];
    expect(latestObv(candles)).toBe(calculateObvSeries(candles).at(-1));
  });
});
