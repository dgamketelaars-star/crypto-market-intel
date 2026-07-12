import { describe, expect, it } from 'vitest';
import { calculateOiChange } from './openInterest';

const HOUR = 60 * 60 * 1000;
const now = 1_700_000_000_000;

describe('calculateOiChange', () => {
  it('returns null for every horizon when there is no history', () => {
    expect(calculateOiChange(1000, now, [])).toEqual({
      change1hPct: null,
      change4hPct: null,
      change24hPct: null,
    });
  });

  it('computes % change against the closest sample at or before each target time', () => {
    const history = [
      { time: now - 24 * HOUR - 2 * 60_000, openInterest: 900 }, // ~24h ago
      { time: now - 4 * HOUR - 60_000, openInterest: 800 }, // ~4h ago
      { time: now - 1 * HOUR, openInterest: 950 }, // exactly 1h ago
    ];
    const result = calculateOiChange(1000, now, history);
    expect(result.change1hPct).toBeCloseTo(((1000 - 950) / 950) * 100, 5);
    expect(result.change4hPct).toBeCloseTo(((1000 - 800) / 800) * 100, 5);
    expect(result.change24hPct).toBeCloseTo(((1000 - 900) / 900) * 100, 5);
  });

  it('treats a sample far outside the tolerance window as missing, not stale', () => {
    // Only a ~2h-old sample exists — too far from the 1h target to trust.
    const history = [{ time: now - 2 * HOUR, openInterest: 500 }];
    const result = calculateOiChange(1000, now, history);
    expect(result.change1hPct).toBeNull();
  });

  it('returns null instead of dividing by zero when the base sample is 0', () => {
    const history = [{ time: now - 1 * HOUR, openInterest: 0 }];
    expect(calculateOiChange(1000, now, history).change1hPct).toBeNull();
  });

  it('is unaffected by sample ordering (sorts internally)', () => {
    const history = [
      { time: now - 1 * HOUR, openInterest: 950 },
      { time: now - 24 * HOUR - 2 * 60_000, openInterest: 900 },
      { time: now - 4 * HOUR - 60_000, openInterest: 800 },
    ];
    const result = calculateOiChange(1000, now, history);
    expect(result.change4hPct).toBeCloseTo(25, 5);
  });
});
