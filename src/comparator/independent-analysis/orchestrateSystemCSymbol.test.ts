import { describe, expect, it } from 'vitest';
import { makeCandlesFromCloses, makeTrendingCloses } from '../../analysis/testUtils/fixtures';
import { orchestrateSystemCSymbol } from './orchestrateSystemCSymbol';
import { createSystemCSetup } from './lifecycle/systemCLifecycle';
import type { SmcReversalSignal } from './signals/liquiditySweepReversal';

const NOW = 1_700_000_000_000;

describe('orchestrateSystemCSymbol', () => {
  it('produces no setup when there is insufficient candle history', () => {
    const { setup } = orchestrateSystemCSymbol({
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
    const signal: SmcReversalSignal = {
      direction: 'LONG',
      entryPrice: 100,
      stopPrice: 90,
      targetPrice: 120,
      targetReason: 'test',
      sweepZone: { type: 'low', level: 91, startIndex: 1, endIndex: 3, sweptIndex: 5 },
      confirmingEvent: { kind: 'BOS', direction: 'bullish', originIndex: 4, level: 95, brokenIndex: 6 },
    };
    const existing = createSystemCSetup('SOLUSDT', signal, NOW - 3_600_000, 'live');
    const { setup } = orchestrateSystemCSymbol({
      symbol: 'SOLUSDT',
      price: 101,
      candles1h: makeCandlesFromCloses(makeTrendingCloses(100, 1, 40)),
      now: NOW,
      existing,
      origin: 'live',
    });
    expect(setup!.status).toBe('active');
  });

  it('passes a closed setup through untouched', () => {
    const signal: SmcReversalSignal = {
      direction: 'LONG',
      entryPrice: 100,
      stopPrice: 90,
      targetPrice: 120,
      targetReason: 'test',
      sweepZone: { type: 'low', level: 91, startIndex: 1, endIndex: 3, sweptIndex: 5 },
      confirmingEvent: { kind: 'BOS', direction: 'bullish', originIndex: 4, level: 95, brokenIndex: 6 },
    };
    const closed = { ...createSystemCSetup('SOLUSDT', signal, NOW - 3_600_000, 'live'), status: 'closed' as const, closedReason: 'target' as const, closedAt: NOW, closedPrice: 120 };
    const { setup } = orchestrateSystemCSymbol({
      symbol: 'SOLUSDT',
      price: 120,
      candles1h: makeCandlesFromCloses(makeTrendingCloses(100, 1, 40)),
      now: NOW,
      existing: closed,
      origin: 'live',
    });
    expect(setup).toBe(closed);
  });
});
