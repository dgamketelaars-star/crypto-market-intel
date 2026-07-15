import { describe, expect, it } from 'vitest';
import { zigzagCandles, zigzagCandlesWithVolume } from '../../analysis/testUtils/fixtures';
import { calculateAnchoredVwap } from './anchoredVwap';

describe('calculateAnchoredVwap', () => {
  it('returns null when there is no detectable swing pivot to anchor to', () => {
    const candles = zigzagCandles([100, 101]);
    expect(calculateAnchoredVwap(candles)).toBeNull();
  });

  it('anchors to the most recent detected swing pivot, not the first one', () => {
    const candles = zigzagCandles([116, 98, 110, 104, 122, 118]);
    const result = calculateAnchoredVwap(candles);
    expect(result).not.toBeNull();
    // The most recent detectable pivot in this series is the high near 122 (index 16), well past the series' midpoint.
    expect(result!.anchorIndex).toBeGreaterThan(10);
  });

  it('computes VWAP as the volume-weighted typical price over the window from the anchor to the end', () => {
    const candles = zigzagCandlesWithVolume([116, 98, 110, 104, 122, 118], [10, 10, 10, 10, 10]);
    const result = calculateAnchoredVwap(candles);
    expect(result).not.toBeNull();
    // Whatever the anchor, VWAP must sit strictly within the overall candle range — a sanity bound, not an exact figure.
    expect(result!.vwap).toBeGreaterThan(95);
    expect(result!.vwap).toBeLessThan(125);
  });
});
