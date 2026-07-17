import { describe, expect, it } from 'vitest';
import { calculateLiquidityZones, type LiquidityOhlc } from './liquiditySweeps';
import type { SwingPoint } from '../structure/swingHighsLows';

function buildCandles(overrides: Record<number, Partial<LiquidityOhlc>>, length = 10): LiquidityOhlc[] {
  return Array.from({ length }, (_, i) => ({ high: 105, low: 99, ...overrides[i] }));
}

describe('calculateLiquidityZones', () => {
  it('clusters two nearby equal lows into one bullish liquidity zone and records when it was swept', () => {
    const candles = buildCandles({ 2: { low: 95.0 }, 5: { low: 95.05 }, 8: { low: 90 } });
    const swings: SwingPoint[] = [
      { index: 2, type: 'low', level: 95.0 },
      { index: 5, type: 'low', level: 95.05 },
    ];

    const zones = calculateLiquidityZones(candles, swings, 0.01);
    expect(zones).toHaveLength(1);
    expect(zones[0].type).toBe('low');
    expect(zones[0].startIndex).toBe(2);
    expect(zones[0].endIndex).toBe(5);
    expect(zones[0].level).toBeCloseTo(95.025);
    expect(zones[0].sweptIndex).toBe(8);
  });

  it('does not report a zone for a single, unclustered swing point', () => {
    const candles = buildCandles({ 2: { low: 95.0 } });
    const swings: SwingPoint[] = [{ index: 2, type: 'low', level: 95.0 }];
    expect(calculateLiquidityZones(candles, swings, 0.01)).toEqual([]);
  });

  it('leaves sweptIndex null when price never traded through the cluster', () => {
    const candles = buildCandles({ 2: { low: 95.0 }, 5: { low: 95.05 } });
    const swings: SwingPoint[] = [
      { index: 2, type: 'low', level: 95.0 },
      { index: 5, type: 'low', level: 95.05 },
    ];
    const zones = calculateLiquidityZones(candles, swings, 0.01);
    expect(zones[0].sweptIndex).toBeNull();
  });

  it('does not cluster two swings that fall outside the range tolerance of each other', () => {
    const candles = buildCandles({ 2: { low: 80.0 }, 5: { low: 95.0 } });
    const swings: SwingPoint[] = [
      { index: 2, type: 'low', level: 80.0 },
      { index: 5, type: 'low', level: 95.0 },
    ];
    expect(calculateLiquidityZones(candles, swings, 0.01)).toEqual([]);
  });
});
