import { describe, expect, it } from 'vitest';
import { calculateMaCompressionPct } from './maCompression';

describe('calculateMaCompressionPct', () => {
  it('returns null with fewer than two usable MA values', () => {
    expect(calculateMaCompressionPct([100], 100)).toBeNull();
    expect(calculateMaCompressionPct([null, null], 100)).toBeNull();
  });

  it('returns null when price is zero', () => {
    expect(calculateMaCompressionPct([100, 101], 0)).toBeNull();
  });

  it('returns the max-min spread as a fraction of price', () => {
    expect(calculateMaCompressionPct([100, 102, 98], 100)).toBeCloseTo(0.04);
  });

  it('ignores null entries when computing the spread', () => {
    expect(calculateMaCompressionPct([100, null, 102], 100)).toBeCloseTo(0.02);
  });

  it('returns 0 for perfectly stacked MAs (maximum compression)', () => {
    expect(calculateMaCompressionPct([100, 100, 100], 100)).toBe(0);
  });
});
