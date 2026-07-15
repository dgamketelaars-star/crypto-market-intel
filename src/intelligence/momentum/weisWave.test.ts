import { describe, expect, it } from 'vitest';
import { zigzagCandlesWithVolume } from '../../analysis/testUtils/fixtures';
import { calculateWeisWaves } from './weisWave';

describe('calculateWeisWaves', () => {
  it('returns insufficient_data with too little history for any swing pivot', () => {
    const candles = zigzagCandlesWithVolume([100, 101], [10]);
    expect(calculateWeisWaves(candles).latestWaveEffortVsResult).toBe('insufficient_data');
  });

  it('builds wave segments alternating up/down between consecutive swing pivots', () => {
    // entry(unused) -> low(98) -> high(110) -> low(104) -> high(122) -> trailing buffer(118, unused)
    const candles = zigzagCandlesWithVolume([116, 98, 110, 104, 122, 118], [10, 10, 10, 10, 10]);
    const result = calculateWeisWaves(candles);
    expect(result.waves.length).toBeGreaterThanOrEqual(2);
    const directions = result.waves.map((w) => w.direction);
    // Consecutive waves must alternate direction.
    for (let i = 1; i < directions.length; i++) expect(directions[i]).not.toBe(directions[i - 1]);
  });

  it('classifies strengthening when the latest wave makes more price progress on markedly less volume than the last same-direction wave', () => {
    // Entry point (105) sits above the first real pivot (98) so 98 is a genuine trough, not just a
    // point on a longer rise. Up-wave 1: 98 -> 110 (progress 12) on heavy volume. Down-wave: 110 -> 104.
    // Up-wave 2: 104 -> 130 (progress 26, much bigger) on comparatively light volume.
    const candles = zigzagCandlesWithVolume([105, 98, 110, 104, 130, 126], [10, 1000, 10, 100, 10]);
    const result = calculateWeisWaves(candles);
    expect(result.latestWaveEffortVsResult).toBe('strengthening');
  });

  it('classifies weakening when the latest wave makes less price progress on markedly more volume than the last same-direction wave', () => {
    // Up-wave 1: 98 -> 122 (progress 24) on light volume. Down-wave: 122 -> 118. Up-wave 2: 118 -> 121 (progress 3, tiny) on heavy volume.
    const candles = zigzagCandlesWithVolume([105, 98, 122, 118, 121, 120.5], [10, 20, 10, 2000, 10]);
    const result = calculateWeisWaves(candles);
    expect(result.latestWaveEffortVsResult).toBe('weakening');
  });
});
