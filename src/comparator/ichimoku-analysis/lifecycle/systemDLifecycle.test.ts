import { describe, expect, it } from 'vitest';
import { advanceSystemDSetup, createSystemDSetup, expireVanishedSystemDSetup } from './systemDLifecycle';
import type { IchimokuSignal } from '../signals/ichimokuSignal';

function makeSignal(overrides: Partial<IchimokuSignal> = {}): IchimokuSignal {
  return {
    direction: 'LONG',
    strength: 'strong',
    triggerType: 'kumo_breakout',
    entryPrice: 100,
    kijun: 95,
    cloudTop: 98,
    cloudBottom: 90,
    cloudThicknessPrice: 8,
    cloudThicknessPct: 8,
    cloudColourAgrees: true,
    chikouConfirms: true,
    reasons: ['Kumo-breakout naar boven door de cloud'],
    cautions: [],
    ...overrides,
  };
}

const NOW = 1_700_000_000_000;

describe('createSystemDSetup', () => {
  it('starts entry_zone_now, with the stop below the far cloud edge for a kumo_breakout LONG', () => {
    const setup = createSystemDSetup('BTCUSDT', makeSignal(), NOW, 'live');
    expect(setup.status).toBe('entry_zone_now');
    expect(setup.stopPrice).toBe(90); // cloudBottom
    expect(setup.targetPrice).toBe(108); // entryPrice + cloudThicknessPrice
  });

  it('uses the kijun as the stop for a tk_cross trigger', () => {
    const setup = createSystemDSetup('BTCUSDT', makeSignal({ triggerType: 'tk_cross' }), NOW, 'live');
    expect(setup.stopPrice).toBe(95); // kijun
  });
});

describe('advanceSystemDSetup', () => {
  it('moves entry_zone_now to active on the next evaluation regardless of price', () => {
    const setup = createSystemDSetup('BTCUSDT', makeSignal(), NOW, 'live');
    const advanced = advanceSystemDSetup(setup, 101, NOW + 1000);
    expect(advanced.status).toBe('active');
  });

  it('closes as invalidated when the stop is hit', () => {
    const setup = { ...createSystemDSetup('BTCUSDT', makeSignal(), NOW, 'live'), status: 'active' as const };
    const closed = advanceSystemDSetup(setup, 89, NOW + 2000);
    expect(closed.status).toBe('invalidated');
    expect(closed.closedReason).toBe('stop');
  });

  it('closes as closed when the target is hit', () => {
    const setup = { ...createSystemDSetup('BTCUSDT', makeSignal(), NOW, 'live'), status: 'active' as const };
    const closed = advanceSystemDSetup(setup, 109, NOW + 2000);
    expect(closed.status).toBe('closed');
    expect(closed.closedReason).toBe('target');
  });

  it('leaves an active setup untouched between the stop and target', () => {
    const setup = { ...createSystemDSetup('BTCUSDT', makeSignal(), NOW, 'live'), status: 'active' as const };
    const result = advanceSystemDSetup(setup, 100.5, NOW + 2000);
    expect(result.status).toBe('active');
    expect(result.closedReason).toBeNull();
  });
});

describe('expireVanishedSystemDSetup', () => {
  it('force-closes an open setup as invalidated with a null price when none is known', () => {
    const setup = createSystemDSetup('BTCUSDT', makeSignal(), NOW, 'live');
    const expired = expireVanishedSystemDSetup(setup, NOW + 5000, null);
    expect(expired!.status).toBe('invalidated');
    expect(expired!.closedReason).toBe('vanished');
    expect(expired!.closedPrice).toBe(setup.entryPrice);
  });

  it('does nothing to an already-closed setup', () => {
    const setup = { ...createSystemDSetup('BTCUSDT', makeSignal(), NOW, 'live'), status: 'closed' as const, closedReason: 'target' as const, closedAt: NOW, closedPrice: 108 };
    expect(expireVanishedSystemDSetup(setup, NOW + 5000, 108)).toBeNull();
  });
});
