import { describe, expect, it } from 'vitest';
import { calculateAverage, calculateRelativeVolume } from './volume';

describe('calculateAverage', () => {
  it('returns null when there is not enough history', () => {
    expect(calculateAverage([1, 2, 3], 20)).toBeNull();
  });

  it('computes a plain mean of the last N values', () => {
    const values = Array.from({ length: 25 }, (_, i) => i + 1); // 1..25
    expect(calculateAverage(values, 20)).toBeCloseTo(15.5); // mean of 6..25
  });
});

describe('calculateRelativeVolume', () => {
  it('is 1 when current equals the average', () => {
    expect(calculateRelativeVolume(100, 100)).toBe(1);
  });

  it('returns null instead of dividing by zero for a zero or missing average', () => {
    expect(calculateRelativeVolume(100, 0)).toBeNull();
    expect(calculateRelativeVolume(100, null)).toBeNull();
  });

  it('handles zero current volume without producing NaN', () => {
    const rel = calculateRelativeVolume(0, 50);
    expect(rel).toBe(0);
    expect(Number.isFinite(rel!)).toBe(true);
  });
});
