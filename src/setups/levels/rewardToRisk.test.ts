import { describe, expect, it } from 'vitest';
import { calculateRewardToRisk } from './rewardToRisk';

describe('calculateRewardToRisk', () => {
  it('computes a simple LONG ratio', () => {
    // entry 100, invalidation 95 (risk 5), target 110 (reward 10) -> RR 2
    expect(calculateRewardToRisk(100, 110, 95, 'LONG')).toBeCloseTo(2);
  });

  it('computes a simple SHORT ratio', () => {
    // entry 100, invalidation 105 (risk 5), target 90 (reward 10) -> RR 2
    expect(calculateRewardToRisk(100, 90, 105, 'SHORT')).toBeCloseTo(2);
  });

  it('returns null when risk is zero or negative (invalidation on the wrong side)', () => {
    expect(calculateRewardToRisk(100, 110, 100, 'LONG')).toBeNull();
    expect(calculateRewardToRisk(100, 110, 105, 'LONG')).toBeNull();
  });

  it('returns null when reward is zero or negative (target on the wrong side)', () => {
    expect(calculateRewardToRisk(100, 95, 90, 'LONG')).toBeNull();
  });
});
