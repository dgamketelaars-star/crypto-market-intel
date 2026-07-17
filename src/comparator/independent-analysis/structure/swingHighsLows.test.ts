import { describe, expect, it } from 'vitest';
import { zigzagCandles } from '../../../analysis/testUtils/fixtures';
import { calculateSwingHighsLows } from './swingHighsLows';

describe('calculateSwingHighsLows', () => {
  it('returns nothing when there are not enough candles for even one window', () => {
    const candles = zigzagCandles([100, 90, 110], 2);
    expect(calculateSwingHighsLows(candles, 50)).toEqual([]);
  });

  it('detects alternating swing points around a zigzag path, bookended at the series edges', () => {
    const candles = zigzagCandles([100, 90, 110, 85, 115], 4);
    const swings = calculateSwingHighsLows(candles, 2);

    expect(swings.length).toBeGreaterThan(0);
    expect(swings[0].index).toBe(0);
    expect(swings[swings.length - 1].index).toBe(candles.length - 1);

    for (let i = 1; i < swings.length; i++) {
      expect(swings[i].type).not.toBe(swings[i - 1].type);
    }

    const lowLevels = swings.filter((s) => s.type === 'low').map((s) => s.level);
    expect(lowLevels.some((level) => Math.abs(level - 90) < 1)).toBe(true);
    const highLevels = swings.filter((s) => s.type === 'high').map((s) => s.level);
    expect(highLevels.some((level) => Math.abs(level - 110) < 1)).toBe(true);
  });
});
