import { describe, expect, it } from 'vitest';
import type { Candle } from '../../services/binance/types';
import { makeCandle, zigzagCandles } from '../../analysis/testUtils/fixtures';
import { detectFailedBreak, detectRetest, detectStructureEvent } from './structureEvents';

// Up-swing pattern: two detectable higher lows (98 -> 104) and two detectable higher highs (110 -> 122).
const UP_SWING_PIVOTS = [116, 98, 110, 104, 122, 118];
// Down-swing pattern: two detectable lower highs (122 -> 110) and two detectable lower lows (104 -> 98).
const DOWN_SWING_PIVOTS = [98, 122, 104, 110, 98, 102];

describe('detectStructureEvent', () => {
  it('returns insufficient_data with fewer than two swing highs/lows', () => {
    const candles = zigzagCandles([100, 105]);
    expect(detectStructureEvent(candles).event).toBe('insufficient_data');
  });

  it('detects a bullish BOS when price breaks above the last swing high in an established uptrend', () => {
    const base = zigzagCandles(UP_SWING_PIVOTS);
    const breakout = makeCandle({ close: 135, high: 135.1, low: 134.9 }, base.length);
    const result = detectStructureEvent([...base, breakout]);
    expect(result.event).toBe('bullish_bos');
    expect(result.brokenLevel?.price).toBeCloseTo(122.05);
  });

  it('detects a bearish CHOCH when price breaks below the last swing low against an established uptrend', () => {
    const base = zigzagCandles(UP_SWING_PIVOTS);
    const breakdown = makeCandle({ close: 90, high: 90.1, low: 89.9 }, base.length);
    const result = detectStructureEvent([...base, breakdown]);
    expect(result.event).toBe('bearish_choch');
    expect(result.brokenLevel?.price).toBeCloseTo(103.95);
  });

  it('detects a bearish BOS as continuation in an established downtrend', () => {
    const base = zigzagCandles(DOWN_SWING_PIVOTS);
    const breakdown = makeCandle({ close: 90, high: 90.1, low: 89.9 }, base.length);
    const result = detectStructureEvent([...base, breakdown]);
    expect(result.event).toBe('bearish_bos');
  });

  it('detects a bullish CHOCH when price breaks above the last swing high against an established downtrend', () => {
    const base = zigzagCandles(DOWN_SWING_PIVOTS);
    const breakout = makeCandle({ close: 130, high: 130.1, low: 129.9 }, base.length);
    const result = detectStructureEvent([...base, breakout]);
    expect(result.event).toBe('bullish_choch');
  });

  it('returns none when price stays inside the last swing range', () => {
    const base = zigzagCandles(UP_SWING_PIVOTS);
    expect(detectStructureEvent(base).event).toBe('none');
  });
});

describe('detectRetest', () => {
  it('flags a retest when price pulls back to the broken level after a bullish BOS and holds', () => {
    const base = zigzagCandles(UP_SWING_PIVOTS);
    const breakout = makeCandle({ close: 135, high: 135.1, low: 134.9 }, base.length);
    const retest = makeCandle({ close: 122.1, high: 122.2, low: 122.0 }, base.length + 1);
    const result = detectRetest([...base, breakout, retest], 'bullish');
    expect(result.isRetesting).toBe(true);
    expect(result.level).toBeCloseTo(122.05);
  });

  it('does not flag a retest when price is nowhere near the broken level', () => {
    const base = zigzagCandles(UP_SWING_PIVOTS);
    const breakout = makeCandle({ close: 135, high: 135.1, low: 134.9 }, base.length);
    const stillFar = makeCandle({ close: 145, high: 145.1, low: 144.9 }, base.length + 1);
    const result = detectRetest([...base, breakout, stillFar], 'bullish');
    expect(result.isRetesting).toBe(false);
  });

  it('returns false with too little history', () => {
    const candles = zigzagCandles([100, 101]);
    expect(detectRetest(candles, 'bullish').isRetesting).toBe(false);
  });
});

function holdCandles(price: number, count: number, startIndex: number): Candle[] {
  return Array.from({ length: count }, (_, i) => makeCandle({ close: price, high: price + 0.05, low: price - 0.05 }, startIndex + i));
}

describe('detectFailedBreak', () => {
  it('detects a failed breakout when price spikes above resistance then closes back below it', () => {
    const base = zigzagCandles(UP_SWING_PIVOTS);
    const spike = makeCandle({ close: 125, high: 128, low: 119 }, base.length);
    const hover = holdCandles(119, 8, base.length + 1);
    const current = makeCandle({ close: 115, high: 119, low: 113 }, base.length + 9);
    expect(detectFailedBreak([...base, spike, ...hover, current], 115)).toBe('failed_breakout');
  });

  it('detects a failed breakdown when price spikes below support then closes back above it', () => {
    const base = zigzagCandles(DOWN_SWING_PIVOTS);
    const spike = makeCandle({ close: 100, high: 103, low: 95 }, base.length);
    const hover = holdCandles(103, 8, base.length + 1);
    const current = makeCandle({ close: 100, high: 103, low: 99 }, base.length + 9);
    expect(detectFailedBreak([...base, spike, ...hover, current], 100)).toBe('failed_breakdown');
  });

  it('returns insufficient_data with too little history', () => {
    const candles = zigzagCandles([100, 101]);
    expect(detectFailedBreak(candles, 100)).toBe('insufficient_data');
  });
});
