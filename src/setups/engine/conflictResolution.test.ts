import { describe, expect, it } from 'vitest';
import { resolveSymbolDirection } from './conflictResolution';
import { evidence as buildEvidence } from './evidence';
import type { SetupEvidence } from './types';
import { makeFamilyResult } from '../testUtils/setupFixtures';

const evidence = (group: SetupEvidence['group']): SetupEvidence => buildEvidence(group, group, group);

describe('resolveSymbolDirection', () => {
  it('returns no_setup when neither direction has any active_ready result', () => {
    const results = [makeFamilyResult({ direction: 'LONG', readiness: 'candidate' })];
    const resolution = resolveSymbolDirection(results);
    expect(resolution.outcome).toBe('no_setup');
  });

  it('returns no_setup when the only active_ready direction has fewer than minActivationScore independent evidence groups', () => {
    const results = [
      makeFamilyResult({ direction: 'LONG', readiness: 'active_ready', supporting: [evidence('trend')], opposing: [] }),
    ];
    const resolution = resolveSymbolDirection(results);
    expect(resolution.outcome).toBe('no_setup');
    expect(resolution.long.qualifies).toBe(false);
  });

  it('activates LONG when only LONG qualifies with >= 2 independent evidence groups', () => {
    const results = [
      makeFamilyResult({
        direction: 'LONG',
        readiness: 'active_ready',
        supporting: [evidence('trend'), evidence('momentum'), evidence('volume')],
        opposing: [],
      }),
    ];
    const resolution = resolveSymbolDirection(results);
    expect(resolution.outcome).toBe('active_long');
    expect(resolution.long.qualifies).toBe(true);
    expect(resolution.short.qualifies).toBe(false);
  });

  it('activates SHORT when only SHORT qualifies', () => {
    const results = [
      makeFamilyResult({
        direction: 'SHORT',
        readiness: 'active_ready',
        supporting: [evidence('trend'), evidence('momentum')],
        opposing: [],
      }),
    ];
    const resolution = resolveSymbolDirection(results);
    expect(resolution.outcome).toBe('active_short');
  });

  it('de-duplicates evidence groups across multiple family results for the same direction', () => {
    const results = [
      makeFamilyResult({ direction: 'LONG', family: 'trend_continuation_breakout', readiness: 'active_ready', supporting: [evidence('trend'), evidence('momentum')], opposing: [] }),
      makeFamilyResult({ direction: 'LONG', family: 'trend_continuation_pullback', readiness: 'active_ready', supporting: [evidence('trend'), evidence('volume')], opposing: [] }),
    ];
    const resolution = resolveSymbolDirection(results);
    // trend appears in both, momentum + volume are each counted once -> distinct groups = {trend, momentum, volume} = 3
    expect(resolution.long.netScore).toBe(3);
    expect(resolution.outcome).toBe('active_long');
  });

  it('subtracts opposing evidence groups from the net score', () => {
    const results = [
      makeFamilyResult({
        direction: 'LONG',
        readiness: 'active_ready',
        supporting: [evidence('trend'), evidence('momentum'), evidence('volume')],
        opposing: [evidence('volatility'), evidence('futures_positioning')],
      }),
    ];
    const resolution = resolveSymbolDirection(results);
    expect(resolution.long.netScore).toBe(1); // 3 supporting - 2 opposing
    expect(resolution.long.qualifies).toBe(false); // below minActivationScore (2)
    expect(resolution.outcome).toBe('no_setup');
  });

  it('never returns both directions active — when both qualify with a clear lead, only the leader activates', () => {
    const results = [
      makeFamilyResult({
        direction: 'LONG',
        readiness: 'active_ready',
        supporting: [evidence('trend'), evidence('momentum'), evidence('volume'), evidence('market_structure')],
        opposing: [],
      }),
      makeFamilyResult({
        direction: 'SHORT',
        readiness: 'active_ready',
        supporting: [evidence('trend'), evidence('momentum')],
        opposing: [],
      }),
    ];
    const resolution = resolveSymbolDirection(results);
    expect(resolution.outcome).toBe('active_long');
    expect(resolution.long.netScore - resolution.short.netScore).toBeGreaterThanOrEqual(1);
  });

  it('returns conflicted (no setup shown) when both directions qualify without a clear dominance margin', () => {
    const results = [
      makeFamilyResult({
        direction: 'LONG',
        readiness: 'active_ready',
        supporting: [evidence('trend'), evidence('momentum')],
        opposing: [],
      }),
      makeFamilyResult({
        direction: 'SHORT',
        readiness: 'active_ready',
        supporting: [evidence('volume'), evidence('market_structure')],
        opposing: [],
      }),
    ];
    const resolution = resolveSymbolDirection(results);
    expect(resolution.outcome).toBe('conflicted');
    expect(resolution.long.qualifies).toBe(true);
    expect(resolution.short.qualifies).toBe(true);
  });

  it('ignores results that are not fully confirmed (only active_ready counts toward the score)', () => {
    const results = [
      makeFamilyResult({
        direction: 'LONG',
        readiness: 'waiting_for_confirmation',
        supporting: [evidence('trend'), evidence('momentum'), evidence('volume')],
        opposing: [],
      }),
    ];
    const resolution = resolveSymbolDirection(results);
    expect(resolution.outcome).toBe('no_setup');
    expect(resolution.long.results).toHaveLength(0);
  });
});
