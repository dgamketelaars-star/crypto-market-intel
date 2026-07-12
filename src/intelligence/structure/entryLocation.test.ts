import { describe, expect, it } from 'vitest';
import { makeCandlesFromCloses } from '../../analysis/testUtils/fixtures';
import { evaluateEntryLocationQuality } from './entryLocation';

describe('evaluateEntryLocationQuality', () => {
  it('blocks with no candle data', () => {
    const result = evaluateEntryLocationQuality('LONG', [], 100, 1, 1);
    expect(result.gateStatus).toBe('blocked');
  });

  it('is usable for LONG when price sits right at a detected support zone', () => {
    // Oscillate to build a repeated swing-low cluster around 95, then land price back at it.
    const closes = [100, 97, 95, 98, 101, 96, 95.2, 99, 102, 97, 95.1, 100, 103, 98, 95.3];
    const candles = makeCandlesFromCloses(closes);
    const result = evaluateEntryLocationQuality('LONG', candles, 95.3, 2, 1);
    expect(result.gateStatus).toBe('usable');
    expect(result.bias).toBe('bullish');
  });

  it('blocks LONG when price is far from any support zone (chasing) and not retesting', () => {
    const closes = [100, 97, 95, 98, 101, 96, 95.2, 99, 102, 97, 95.1, 100, 103, 98, 130];
    const candles = makeCandlesFromCloses(closes);
    const result = evaluateEntryLocationQuality('LONG', candles, 130, 2, 1);
    expect(result.gateStatus).toBe('blocked');
  });

  it('is usable for SHORT when price sits right at a detected resistance zone', () => {
    const closes = [100, 103, 105, 102, 99, 104, 104.8, 101, 98, 103, 104.9, 100, 97, 102, 104.7];
    const candles = makeCandlesFromCloses(closes);
    const result = evaluateEntryLocationQuality('SHORT', candles, 104.7, 2, 1);
    expect(result.gateStatus).toBe('usable');
    expect(result.bias).toBe('bearish');
  });
});
