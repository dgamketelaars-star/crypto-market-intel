import { describe, expect, it } from 'vitest';
import { calculateBosChoch, type OhlcCloseLike } from './bosChoch';
import type { SwingPoint } from './swingHighsLows';

function flatCandlesThenBreak(breakoutIndex: number, breakoutClose: number, baseline = 100, length = 12): OhlcCloseLike[] {
  return Array.from({ length }, (_, i) => {
    const close = i >= breakoutIndex ? breakoutClose : baseline;
    return { close, high: close, low: close };
  });
}

describe('calculateBosChoch', () => {
  it('confirms a bullish BOS when a higher low is followed by a higher high, and price later closes back above the prior high', () => {
    const swings: SwingPoint[] = [
      { index: 0, type: 'low', level: 100 },
      { index: 2, type: 'high', level: 110 },
      { index: 4, type: 'low', level: 105 }, // higher low -> continuation
      { index: 6, type: 'high', level: 115 }, // higher high
    ];
    const candles = flatCandlesThenBreak(8, 120);

    const events = calculateBosChoch(candles, swings);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('BOS');
    expect(events[0].direction).toBe('bullish');
    expect(events[0].originIndex).toBe(4);
    expect(events[0].level).toBe(110);
    expect(events[0].brokenIndex).toBe(8);
  });

  it('confirms a bullish CHOCH when a lower low is nonetheless followed by a higher high', () => {
    const swings: SwingPoint[] = [
      { index: 0, type: 'low', level: 100 },
      { index: 2, type: 'high', level: 110 },
      { index: 4, type: 'low', level: 95 }, // lower low -> character change
      { index: 6, type: 'high', level: 120 },
    ];
    const candles = flatCandlesThenBreak(8, 125);

    const events = calculateBosChoch(candles, swings);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('CHOCH');
    expect(events[0].direction).toBe('bullish');
  });

  it('reports nothing when the structural break never gets price-confirmed', () => {
    const swings: SwingPoint[] = [
      { index: 0, type: 'low', level: 100 },
      { index: 2, type: 'high', level: 110 },
      { index: 4, type: 'low', level: 105 },
      { index: 6, type: 'high', level: 115 },
    ];
    // Price never closes back above 110.
    const candles = flatCandlesThenBreak(999, 100);

    expect(calculateBosChoch(candles, swings)).toEqual([]);
  });

  it('mirrors bearish BOS for a lower-high/lower-low sequence', () => {
    const swings: SwingPoint[] = [
      { index: 0, type: 'high', level: 120 },
      { index: 2, type: 'low', level: 110 },
      { index: 4, type: 'high', level: 115 }, // lower high -> continuation down
      { index: 6, type: 'low', level: 105 }, // lower low
    ];
    const candles = flatCandlesThenBreak(8, 95, 120);

    const events = calculateBosChoch(candles, swings);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('BOS');
    expect(events[0].direction).toBe('bearish');
    expect(events[0].brokenIndex).toBe(8);
  });
});
