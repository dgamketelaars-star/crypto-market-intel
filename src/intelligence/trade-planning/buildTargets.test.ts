import { describe, expect, it } from 'vitest';
import { zigzagCandles } from '../../analysis/testUtils/fixtures';
import { buildTargets } from './buildTargets';

describe('buildTargets — volume-profile targets', () => {
  it('includes a volume-profile-sourced target when a high-volume node exists beyond entry with no coinciding swing zone', () => {
    // Higher highs/higher lows swing pattern (100 -> 130), plus a deliberately heavy-volume band
    // around 118-120 that isn't one of the hand-placed swing pivots, giving buildVolumeProfile an
    // HVN candidate the swing-only search wouldn't find.
    const base = zigzagCandles([90, 100, 95, 110, 105, 130, 120]);
    const heavyBand = base.map((c, i) => (c.close >= 117 && c.close <= 121 ? { ...c, volume: 5000 } : { ...c, volume: 20 + i }));

    const targets = buildTargets({
      direction: 'LONG',
      triggerPrice: 105,
      invalidationPrice: 100,
      structuralCandles: heavyBand,
      horizon: 'SWING_TRADE',
      atr1h: 1,
      atr4h: 1,
      volatility: 'normal',
      timeframe: '4h',
    });

    expect(targets.some((t) => t.method === 'volume-profile-level' || t.explanation.includes('Volume-profile'))).toBe(true);
  });

  it('marks a target as confluence when a swing zone and a volume-profile level coincide', () => {
    // Give the resistance pivot at 130 disproportionately heavy volume so it also becomes the profile's POC/HVN.
    const base = zigzagCandles([90, 100, 95, 110, 105, 130, 120]);
    const heavyAtPivot = base.map((c) => (Math.abs(c.close - 130) < 1 ? { ...c, volume: 8000 } : { ...c, volume: 20 }));

    const targets = buildTargets({
      direction: 'LONG',
      triggerPrice: 105,
      invalidationPrice: 100,
      structuralCandles: heavyAtPivot,
      horizon: 'SWING_TRADE',
      atr1h: 1,
      atr4h: 1,
      volatility: 'normal',
      timeframe: '4h',
    });

    expect(targets.some((t) => t.explanation.includes('confluence'))).toBe(true);
  });
});
