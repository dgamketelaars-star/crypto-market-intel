import { describe, expect, it } from 'vitest';
import { calculateRsiSeries, latestRsi } from './rsi';

describe('calculateRsiSeries', () => {
  it('returns null before period+1 candles exist', () => {
    const series = calculateRsiSeries([1, 2, 3], 14);
    expect(series.every((v) => v === null)).toBe(true);
  });

  it('returns 100 for a strictly rising series (no losses)', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
    expect(latestRsi(closes, 14)).toBe(100);
  });

  it('returns 0 for a strictly falling series (no gains)', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 - i);
    expect(latestRsi(closes, 14)).toBe(0);
  });

  it('stays within [0, 100] and finite for mixed data', () => {
    const closes = [10, 12, 9, 15, 11, 14, 13, 16, 10, 18, 17, 20, 15, 22, 19, 25];
    for (const v of calculateRsiSeries(closes, 14)) {
      if (v === null) continue;
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it('handles a completely flat series without NaN (avg loss and avg gain both zero)', () => {
    const closes = Array.from({ length: 20 }, () => 100);
    expect(latestRsi(closes, 14)).toBe(50);
  });
});
