import { describe, expect, it } from 'vitest';
import { allocateTargetPortions, finalizeTargets } from './targetPortions';
import { makeTargetCandidate } from '../testUtils/setupFixtures';

describe('allocateTargetPortions', () => {
  it('returns [100] for a single target regardless of volatility', () => {
    expect(allocateTargetPortions(1, 'normal')).toEqual([100]);
    expect(allocateTargetPortions(1, 'extreme')).toEqual([100]);
  });

  it('returns 0 targets for a count of 0', () => {
    expect(allocateTargetPortions(0, 'normal')).toEqual([]);
  });

  it.each(['normal', 'elevated', 'extreme'] as const)('sums to exactly 100 for two targets (%s)', (vol) => {
    const portions = allocateTargetPortions(2, vol);
    expect(portions).toHaveLength(2);
    expect(portions.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it.each(['normal', 'elevated', 'extreme'] as const)('sums to exactly 100 for three targets (%s)', (vol) => {
    const portions = allocateTargetPortions(3, vol);
    expect(portions).toHaveLength(3);
    expect(portions.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('front-loads more into the earlier targets as volatility rises (two targets)', () => {
    const normal = allocateTargetPortions(2, 'normal');
    const elevated = allocateTargetPortions(2, 'elevated');
    const extreme = allocateTargetPortions(2, 'extreme');
    expect(normal[0]).toBeLessThan(elevated[0]);
    expect(elevated[0]).toBeLessThan(extreme[0]);
  });

  it.each([4, 5, 6])('sums to exactly 100 and folds rounding into the final target for %d targets', (count) => {
    const portions = allocateTargetPortions(count, 'normal');
    expect(portions).toHaveLength(count);
    expect(portions.reduce((a, b) => a + b, 0)).toBe(100);
  });
});

describe('finalizeTargets', () => {
  it('orders LONG targets nearest-first and marks the furthest as final', () => {
    const raw = [makeTargetCandidate({ price: 140 }), makeTargetCandidate({ price: 120 }), makeTargetCandidate({ price: 130 })];
    const targets = finalizeTargets(raw, 'LONG', 'normal');
    expect(targets.map((t) => t.price)).toEqual([120, 130, 140]);
    expect(targets.map((t) => t.order)).toEqual([1, 2, 3]);
    expect(targets.filter((t) => t.isFinal)).toHaveLength(1);
    expect(targets.find((t) => t.isFinal)?.price).toBe(140);
    expect(targets.every((t) => t.status === 'pending')).toBe(true);
  });

  it('orders SHORT targets nearest-first (descending price) and marks the furthest (lowest) as final', () => {
    const raw = [makeTargetCandidate({ price: 80 }), makeTargetCandidate({ price: 95 }), makeTargetCandidate({ price: 90 })];
    const targets = finalizeTargets(raw, 'SHORT', 'normal');
    expect(targets.map((t) => t.price)).toEqual([95, 90, 80]);
    expect(targets.find((t) => t.isFinal)?.price).toBe(80);
  });

  it('assigns portions that always sum to exactly 100', () => {
    const raw = [makeTargetCandidate({ price: 120 }), makeTargetCandidate({ price: 130 })];
    const targets = finalizeTargets(raw, 'LONG', 'extreme');
    expect(targets.reduce((sum, t) => sum + t.positionPortionPct, 0)).toBe(100);
  });

  it('returns an empty array (no activation possible) when there are no raw target candidates', () => {
    expect(finalizeTargets([], 'LONG', 'normal')).toEqual([]);
  });

  it('assigns 100% and isFinal=true to a single defensible target', () => {
    const targets = finalizeTargets([makeTargetCandidate({ price: 150 })], 'LONG', 'normal');
    expect(targets).toHaveLength(1);
    expect(targets[0].positionPortionPct).toBe(100);
    expect(targets[0].isFinal).toBe(true);
  });
});
