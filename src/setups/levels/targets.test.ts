import { describe, expect, it } from 'vitest';
import { buildAtrTarget, buildMeasuredMoveTarget, buildZoneTarget } from './targets';

describe('buildAtrTarget', () => {
  it('builds a LONG target above entry and reports reward:risk', () => {
    // entry 100, atr 4, mult 1.5 -> target 106, invalidation 98 (risk 2, reward 6, RR 3)
    const target = buildAtrTarget(100, 4, 1.5, 'LONG', 98, '1h');
    expect(target).not.toBeNull();
    expect(target!.price).toBeCloseTo(106);
    expect(target!.rewardToRisk).toBeCloseTo(3);
  });

  it('returns null when reward:risk is below the documented minimum', () => {
    // entry 100, atr 0.5, mult 1 -> target 100.5, invalidation 90 (risk 10, reward 0.5, RR 0.05)
    const target = buildAtrTarget(100, 0.5, 1, 'LONG', 90, '1h');
    expect(target).toBeNull();
  });
});

describe('buildZoneTarget', () => {
  it('uses the zone price directly as the target', () => {
    const target = buildZoneTarget(100, 120, 'resistance', 'LONG', 95, '1h');
    expect(target?.price).toBe(120);
  });
});

describe('buildMeasuredMoveTarget', () => {
  it('projects the prior range width from the break level', () => {
    // range 100 (break) - 90 (opposite) = 10 wide, projected from 100 -> target 110
    const target = buildMeasuredMoveTarget(100, 100, 90, 'LONG', 95, '1h');
    expect(target?.price).toBeCloseTo(110);
  });

  it('returns null for a zero-width range', () => {
    expect(buildMeasuredMoveTarget(100, 100, 100, 'LONG', 95, '1h')).toBeNull();
  });
});
