import { describe, expect, it } from 'vitest';
import { advanceSystemCSetup, createSystemCSetup, expireVanishedSystemCSetup } from './systemCLifecycle';
import type { SmcReversalSignal } from '../signals/liquiditySweepReversal';

const NOW = 1_700_000_000_000;

function makeSignal(direction: 'LONG' | 'SHORT'): SmcReversalSignal {
  const entryPrice = 100;
  return {
    direction,
    entryPrice,
    stopPrice: direction === 'LONG' ? 90 : 110,
    targetPrice: direction === 'LONG' ? 120 : 80,
    targetReason: 'test target',
    sweepZone: { type: direction === 'LONG' ? 'low' : 'high', level: 91, startIndex: 1, endIndex: 3, sweptIndex: 5 },
    confirmingEvent: { kind: 'BOS', direction: direction === 'LONG' ? 'bullish' : 'bearish', originIndex: 4, level: 95, brokenIndex: 6 },
  };
}

describe('createSystemCSetup', () => {
  it('creates a setup in entry_zone_now status carrying the signal stop/target', () => {
    const setup = createSystemCSetup('SOLUSDT', makeSignal('LONG'), NOW, 'live');
    expect(setup.status).toBe('entry_zone_now');
    expect(setup.stopPrice).toBe(90);
    expect(setup.targetPrice).toBe(120);
  });
});

describe('advanceSystemCSetup', () => {
  it('transitions entry_zone_now -> active on the next evaluation', () => {
    const setup = createSystemCSetup('SOLUSDT', makeSignal('LONG'), NOW, 'live');
    const active = advanceSystemCSetup(setup, 101, NOW + 1000);
    expect(active.status).toBe('active');
  });

  it('invalidates a LONG setup once the structural stop is hit', () => {
    let setup = createSystemCSetup('SOLUSDT', makeSignal('LONG'), NOW, 'live');
    setup = advanceSystemCSetup(setup, 100, NOW);
    const invalidated = advanceSystemCSetup(setup, 89, NOW + 1000);
    expect(invalidated.status).toBe('invalidated');
    expect(invalidated.closedReason).toBe('stop');
  });

  it('closes a LONG setup once the liquidity target is hit', () => {
    let setup = createSystemCSetup('SOLUSDT', makeSignal('LONG'), NOW, 'live');
    setup = advanceSystemCSetup(setup, 100, NOW);
    const closed = advanceSystemCSetup(setup, 121, NOW + 1000);
    expect(closed.status).toBe('closed');
    expect(closed.closedReason).toBe('target');
  });

  it('mirrors stop/target logic for a SHORT setup', () => {
    let setup = createSystemCSetup('SOLUSDT', makeSignal('SHORT'), NOW, 'live');
    setup = advanceSystemCSetup(setup, 100, NOW);
    const invalidated = advanceSystemCSetup(setup, 111, NOW + 1000);
    expect(invalidated.closedReason).toBe('stop');
  });
});

describe('expireVanishedSystemCSetup', () => {
  it('force-invalidates an open setup once its symbol leaves the tracked universe', () => {
    const setup = createSystemCSetup('SOLUSDT', makeSignal('LONG'), NOW, 'live');
    const expired = expireVanishedSystemCSetup(setup, NOW + 1000, 95);
    expect(expired!.status).toBe('invalidated');
    expect(expired!.closedReason).toBe('vanished');
  });

  it('does nothing to an already-closed setup', () => {
    let setup = createSystemCSetup('SOLUSDT', makeSignal('LONG'), NOW, 'live');
    setup = advanceSystemCSetup(setup, 100, NOW);
    setup = advanceSystemCSetup(setup, 121, NOW + 1000);
    expect(expireVanishedSystemCSetup(setup, NOW + 2000, 121)).toBeNull();
  });
});
