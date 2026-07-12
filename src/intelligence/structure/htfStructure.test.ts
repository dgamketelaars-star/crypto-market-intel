import { describe, expect, it } from 'vitest';
import { makeCandle, zigzagCandles } from '../../analysis/testUtils/fixtures';
import { evaluateHtfStructure } from './htfStructure';

const UP_SWING_PIVOTS = [116, 98, 110, 104, 122, 118];
const DOWN_SWING_PIVOTS = [98, 122, 104, 110, 98, 102];

describe('evaluateHtfStructure', () => {
  it('blocks the gate when both timeframes have insufficient data', () => {
    const thin = zigzagCandles([100, 101]);
    const result = evaluateHtfStructure(thin, thin, 1);
    expect(result.gateStatus).toBe('blocked');
    expect(result.blockedReason).toContain('Insufficient');
  });

  it('is usable with a bullish bias when 1D shows a fresh bullish BOS', () => {
    const base1d = zigzagCandles(UP_SWING_PIVOTS);
    const breakout1d = makeCandle({ close: 135, high: 135.1, low: 134.9 }, base1d.length);
    const thin4h = zigzagCandles([100, 101]);
    const result = evaluateHtfStructure(thin4h, [...base1d, breakout1d], 1);
    expect(result.gateStatus).toBe('usable');
    expect(result.bias).toBe('bullish');
  });

  it('falls back to 4H when 1D has no fresh event', () => {
    const base4h = zigzagCandles(UP_SWING_PIVOTS);
    const breakout4h = makeCandle({ close: 135, high: 135.1, low: 134.9 }, base4h.length);
    const flat1d = zigzagCandles(UP_SWING_PIVOTS); // no break appended -> event 'none'
    const result = evaluateHtfStructure([...base4h, breakout4h], flat1d, 1);
    expect(result.gateStatus).toBe('usable');
    expect(result.bias).toBe('bullish');
  });

  it('blocks the gate when 4H and 1D structure directly conflict', () => {
    const baseUp = zigzagCandles(UP_SWING_PIVOTS);
    const bullishBreak = makeCandle({ close: 135, high: 135.1, low: 134.9 }, baseUp.length);
    const baseDown = zigzagCandles(DOWN_SWING_PIVOTS);
    const bearishBreak = makeCandle({ close: 90, high: 90.1, low: 89.9 }, baseDown.length);
    const result = evaluateHtfStructure([...baseUp, bullishBreak], [...baseDown, bearishBreak], 1);
    expect(result.gateStatus).toBe('blocked');
    expect(result.blockedReason).toContain('conflict');
  });

  it('is usable with a neutral bias when neither timeframe shows an active structural event', () => {
    const flat4h = zigzagCandles(UP_SWING_PIVOTS);
    const flat1d = zigzagCandles(UP_SWING_PIVOTS);
    const result = evaluateHtfStructure(flat4h, flat1d, 1);
    expect(result.gateStatus).toBe('usable');
    expect(result.bias).toBe('neutral');
  });
});
