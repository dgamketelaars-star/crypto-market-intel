import { describe, expect, it } from 'vitest';
import { makeCandlesFromCloses, makeTrendingCloses } from '../../analysis/testUtils/fixtures';
import { orchestrateSystemDSymbol } from './orchestrateSystemDSymbol';
import { createSystemDSetup } from './lifecycle/systemDLifecycle';
import type { IchimokuSignal } from './signals/ichimokuSignal';

const NOW = 1_700_000_000_000;

function makeSignal(): IchimokuSignal {
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
    reasons: ['test'],
    cautions: [],
  };
}

describe('orchestrateSystemDSymbol', () => {
  it('produces no setup when there is insufficient candle history for the longest Ichimoku window', () => {
    const { setup } = orchestrateSystemDSymbol({
      symbol: 'SOLUSDT',
      price: 100,
      candles1h: makeCandlesFromCloses(makeTrendingCloses(100, 1, 5)),
      now: NOW,
      existing: null,
      origin: 'live',
    });
    expect(setup).toBeNull();
  });

  it('advances an existing open setup rather than re-detecting a fresh entry', () => {
    const existing = createSystemDSetup('SOLUSDT', makeSignal(), NOW - 3_600_000, 'live');
    const { setup } = orchestrateSystemDSymbol({
      symbol: 'SOLUSDT',
      price: 101,
      candles1h: makeCandlesFromCloses(makeTrendingCloses(100, 1, 100)),
      now: NOW,
      existing,
      origin: 'live',
    });
    expect(setup!.status).toBe('active');
  });

  it('passes a closed setup through untouched', () => {
    const closed = { ...createSystemDSetup('SOLUSDT', makeSignal(), NOW - 3_600_000, 'live'), status: 'closed' as const, closedReason: 'target' as const, closedAt: NOW, closedPrice: 108 };
    const { setup } = orchestrateSystemDSymbol({
      symbol: 'SOLUSDT',
      price: 108,
      candles1h: makeCandlesFromCloses(makeTrendingCloses(100, 1, 100)),
      now: NOW,
      existing: closed,
      origin: 'live',
    });
    expect(setup).toBe(closed);
  });
});
