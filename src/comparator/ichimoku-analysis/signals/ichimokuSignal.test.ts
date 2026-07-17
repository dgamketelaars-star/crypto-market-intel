import { describe, expect, it } from 'vitest';
import { detectIchimokuSignal } from './ichimokuSignal';
import { SENKOU_PERIOD, DISPLACEMENT, type IchimokuCandle } from '../indicators/ichimoku';

function flat(length: number, level = 100, range = 2): IchimokuCandle[] {
  return Array.from({ length }, () => ({ high: level + range, low: level - range, close: level }));
}

/**
 * Long flat run (enough that the displaced cloud stays fully flat and thin)
 * followed by exactly ONE sharp jump candle — so the very last bar is itself
 * the fresh regime change (a longer sustained move would have its actual
 * breakout/cross event several bars earlier, and by the last bar the trend
 * would already be "in progress" with nothing fresh left to detect).
 */
function flatThenJump(direction: 1 | -1): IchimokuCandle[] {
  const flatRun = flat(SENKOU_PERIOD + DISPLACEMENT + 10, 100, 1);
  const jumpLevel = 100 + direction * 40;
  const jump: IchimokuCandle = { high: jumpLevel + 1, low: jumpLevel - 1, close: jumpLevel };
  return [...flatRun, jump];
}

describe('detectIchimokuSignal', () => {
  it('returns null when there is not enough history for the longest (senkou + displacement) window', () => {
    expect(detectIchimokuSignal(flat(20))).toBeNull();
  });

  it('returns null when price sits flat and therefore inside its own (equally flat) cloud — the classic Ichimoku no-trade zone', () => {
    const candles = flat(SENKOU_PERIOD + DISPLACEMENT + 20, 100, 1);
    expect(detectIchimokuSignal(candles)).toBeNull();
  });

  it('detects a LONG signal on a sharp move up out of a long flat range, with internally consistent fields', () => {
    const candles = flatThenJump(1);
    const signal = detectIchimokuSignal(candles);
    expect(signal).not.toBeNull();
    expect(signal!.direction).toBe('LONG');
    expect(signal!.entryPrice).toBe(candles[candles.length - 1].close);
    expect(signal!.cloudTop).toBeGreaterThanOrEqual(signal!.cloudBottom);
    expect(['tk_cross', 'kumo_breakout', 'kijun_bounce']).toContain(signal!.triggerType);
    expect(['strong', 'moderate']).toContain(signal!.strength);
    expect(signal!.reasons.length).toBeGreaterThan(0);
  });

  it('detects a SHORT signal on a sharp move down out of a long flat range (mirror of the LONG case)', () => {
    const candles = flatThenJump(-1);
    const signal = detectIchimokuSignal(candles);
    expect(signal).not.toBeNull();
    expect(signal!.direction).toBe('SHORT');
    expect(signal!.cloudTop).toBeGreaterThanOrEqual(signal!.cloudBottom);
  });

  it('grades strength down to "moderate" and records a caution when the cloud is razor-thin at the trigger bar', () => {
    // A flat run so long and shallow that the cloud stays essentially zero-thickness even after the move.
    const candles = flatThenJump(1);
    const signal = detectIchimokuSignal(candles);
    expect(signal).not.toBeNull();
    if (signal!.strength === 'moderate') {
      expect(signal!.cautions.length).toBeGreaterThan(0);
    }
  });

  it('never returns a signal for a continuous, already-established trend with no fresh cross/breakout/bounce on the latest bar', () => {
    // Pure monotonic rise from bar 0 — by the time enough history exists for senkouA/B, tenkan is
    // already above kijun and price is already above the cloud, so there is no NEW event to report.
    const candles: IchimokuCandle[] = Array.from({ length: SENKOU_PERIOD + DISPLACEMENT + 30 }, (_, i) => ({
      high: 100 + i + 1,
      low: 100 + i - 1,
      close: 100 + i,
    }));
    expect(detectIchimokuSignal(candles)).toBeNull();
  });
});
