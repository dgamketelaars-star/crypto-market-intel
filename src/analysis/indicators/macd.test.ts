import { describe, expect, it } from 'vitest';
import { latestMacd } from './macd';

describe('latestMacd', () => {
  it('returns null when there is not enough history for slow+signal', () => {
    const closes = Array.from({ length: 10 }, (_, i) => 100 + i);
    expect(latestMacd(closes)).toBeNull();
  });

  it('produces finite macd/signal/histogram once enough history exists', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 3) * 5 + i * 0.2);
    const point = latestMacd(closes);
    expect(point).not.toBeNull();
    expect(Number.isFinite(point!.macdLine)).toBe(true);
    expect(Number.isFinite(point!.signalLine)).toBe(true);
    expect(point!.histogram).toBeCloseTo(point!.macdLine - point!.signalLine, 10);
  });

  it('a sustained uptrend produces a positive MACD line', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + i);
    expect(latestMacd(closes)!.macdLine).toBeGreaterThan(0);
  });

  it('a sustained downtrend produces a negative MACD line', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 500 - i);
    expect(latestMacd(closes)!.macdLine).toBeLessThan(0);
  });
});
