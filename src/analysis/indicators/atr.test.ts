import { describe, expect, it } from 'vitest';
import { calculateTrueRangeSeries, latestAtr } from './atr';

describe('ATR', () => {
  it('true range for the first candle is just its high-low range', () => {
    const tr = calculateTrueRangeSeries([{ high: 110, low: 100, close: 105 }]);
    expect(tr[0]).toBe(10);
  });

  it('returns null before `period` candles exist', () => {
    const candles = Array.from({ length: 5 }, () => ({ high: 101, low: 99, close: 100 }));
    expect(latestAtr(candles, 14)).toBeNull();
  });

  it('equals the fixed range for a series of identical fixed-range candles', () => {
    const candles = Array.from({ length: 20 }, () => ({ high: 102, low: 98, close: 100 }));
    expect(latestAtr(candles, 14)).toBeCloseTo(4, 5);
  });

  it('is exactly 0 (not NaN) for zero-range, zero-movement candles', () => {
    const candles = Array.from({ length: 20 }, () => ({ high: 100, low: 100, close: 100 }));
    const atr = latestAtr(candles, 14);
    expect(atr).toBe(0);
    expect(Number.isFinite(atr!)).toBe(true);
  });

  it('accounts for gaps via the previous close, not just the current bar range', () => {
    const candles = [
      { high: 100, low: 98, close: 99 },
      { high: 130, low: 128, close: 129 }, // gapped up hard from prior close 99
    ];
    const tr = calculateTrueRangeSeries(candles);
    expect(tr[1]).toBe(Math.abs(130 - 99));
  });
});
