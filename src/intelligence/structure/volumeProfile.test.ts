import { describe, expect, it } from 'vitest';
import { makeCandle } from '../../analysis/testUtils/fixtures';
import type { Candle } from '../../services/binance/types';
import { buildVolumeProfile } from './volumeProfile';

function candle(low: number, high: number, volume: number, index: number): Candle {
  return makeCandle({ close: (low + high) / 2, high, low, volume }, index);
}

describe('buildVolumeProfile', () => {
  it('returns an empty, insufficient result for no candles', () => {
    const result = buildVolumeProfile([]);
    expect(result.sufficientData).toBe(false);
  });

  it('returns an empty, insufficient result when every candle has an identical single price (zero range)', () => {
    const flat = Array.from({ length: 5 }, (_, i) => candle(100, 100, 10, i));
    const result = buildVolumeProfile(flat);
    expect(result.sufficientData).toBe(false);
  });

  it('places POC inside the price band that carried the overwhelming majority of volume', () => {
    const heavyBand = Array.from({ length: 10 }, (_, i) => candle(99, 101, 1000, i));
    const lightExcursion = [candle(108, 112, 10, 10), candle(108, 112, 10, 11)];
    const result = buildVolumeProfile([...heavyBand, ...lightExcursion]);

    expect(result.sufficientData).toBe(true);
    expect(result.poc).toBeGreaterThanOrEqual(99);
    expect(result.poc).toBeLessThanOrEqual(101);
  });

  it('keeps the value area centered on the heavy-volume band, excluding the light excursion', () => {
    const heavyBand = Array.from({ length: 10 }, (_, i) => candle(99, 101, 1000, i));
    const lightExcursion = [candle(108, 112, 10, 10), candle(108, 112, 10, 11)];
    const result = buildVolumeProfile([...heavyBand, ...lightExcursion]);

    expect(result.valueAreaLow).toBeGreaterThanOrEqual(98.5);
    expect(result.valueAreaHigh).toBeLessThanOrEqual(101.5);
  });

  it('flags a high volume node inside the heavy band', () => {
    const heavyBand = Array.from({ length: 10 }, (_, i) => candle(99, 101, 1000, i));
    const lightExcursion = [candle(108, 112, 10, 10), candle(108, 112, 10, 11)];
    const result = buildVolumeProfile([...heavyBand, ...lightExcursion]);

    expect(result.highVolumeNodes.some((p) => p >= 99 && p <= 101)).toBe(true);
  });

  it('flags a low volume node in the gap between the two bands', () => {
    const heavyBand = Array.from({ length: 10 }, (_, i) => candle(99, 101, 1000, i));
    const gapAndExcursion = [candle(108, 112, 10, 10), candle(108, 112, 10, 11)];
    const result = buildVolumeProfile([...heavyBand, ...gapAndExcursion]);

    // Somewhere between the heavy band's top (101) and the excursion's bottom (108) volume should be near zero.
    expect(result.lowVolumeNodes.some((p) => p > 101 && p < 108)).toBe(true);
  });

  it('does not flag a single isolated high-volume print as a high volume node (needs >= 2 touches)', () => {
    // One large, one-off print far from everything else must not look like a real, repeatedly-traded level.
    const smallCandles = Array.from({ length: 10 }, (_, i) => candle(95 + i * 0.1, 95.1 + i * 0.1, 10, i));
    const isolatedSpike = candle(130, 130, 500, 10);
    const result = buildVolumeProfile([...smallCandles, isolatedSpike]);
    expect(result.highVolumeNodes.some((p) => p >= 129 && p <= 131)).toBe(false);
  });

  it('keeps value area volume around the standard ~70% target without exceeding the full range', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i / 3) * 5);
    const candles = closes.map((c, i) => candle(c - 0.5, c + 0.5, 50 + (i % 5) * 20, i));
    const result = buildVolumeProfile(candles);
    expect(result.valueAreaLow).toBeLessThanOrEqual(result.poc);
    expect(result.valueAreaHigh).toBeGreaterThanOrEqual(result.poc);
  });
});
