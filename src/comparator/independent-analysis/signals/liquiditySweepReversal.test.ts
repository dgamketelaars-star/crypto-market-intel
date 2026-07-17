import { describe, expect, it } from 'vitest';
import { makeCandle } from '../../../analysis/testUtils/fixtures';
import { detectLiquiditySweepReversal, type LiquiditySweepCandle } from './liquiditySweepReversal';

/**
 * Decline into a range (forming two near-equal lows ~110), a sweep below
 * that cluster, a small bounce, then a strong reversal rally that closes
 * back above the prior high — the textbook setup this file's logic looks
 * for. Deliberately not asserting exact numeric levels for the "or none"
 * variant below (the swing/liquidity pipeline has many interacting steps):
 * if a signal comes out, it must be internally consistent, matching the
 * "whatever the real pipeline concludes must be coherent" convention used
 * in orchestrateSymbol.test.ts.
 */
function buildSweepAndReclaimCandles(pivots = [150, 110, 116, 110.3, 113, 105, 125], segment = 3): LiquiditySweepCandle[] {
  const closes: number[] = [];
  for (let p = 0; p < pivots.length - 1; p++) {
    const from = pivots[p];
    const to = pivots[p + 1];
    for (let s = 0; s < segment; s++) closes.push(from + ((to - from) * s) / segment);
  }
  closes.push(pivots[pivots.length - 1]);
  return closes.map((close, i) => makeCandle({ close, high: close + 0.05, low: close - 0.05, volume: 100 }, i));
}

describe('detectLiquiditySweepReversal', () => {
  it('returns null for too little history', () => {
    const candles = buildSweepAndReclaimCandles().slice(0, 5);
    expect(detectLiquiditySweepReversal(candles)).toBeNull();
  });

  it('produces an internally consistent signal (or none) for a sweep-then-reclaim price path', () => {
    const candles = buildSweepAndReclaimCandles();
    const signal = detectLiquiditySweepReversal(candles);

    if (signal === null) return; // a specific swingLength may not align perfectly with this synthetic path — that's fine, absence is also a valid outcome
    if (signal.direction === 'LONG') {
      expect(signal.stopPrice).toBeLessThan(signal.entryPrice);
      expect(signal.targetPrice).toBeGreaterThan(signal.entryPrice);
    } else {
      expect(signal.stopPrice).toBeGreaterThan(signal.entryPrice);
      expect(signal.targetPrice).toBeLessThan(signal.entryPrice);
    }
  });

  it('finds a LONG signal once price sweeps a cluster of equal lows and then reclaims structure', () => {
    const candles = buildSweepAndReclaimCandles();
    const signal = detectLiquiditySweepReversal(candles, 2);
    expect(signal).not.toBeNull();
    expect(signal!.direction).toBe('LONG');
    expect(signal!.sweepZone.type).toBe('low');
    expect(signal!.sweepZone.level).toBeCloseTo(110.1, 0);
    expect(signal!.stopPrice).toBeLessThan(signal!.entryPrice);
    expect(signal!.targetPrice).toBeGreaterThan(signal!.entryPrice);
  });
});
