import { describe, expect, it } from 'vitest';
import { makeCandlesFromCloses, makeTrendingCloses } from '../../analysis/testUtils/fixtures';
import { orchestrateSystemBSymbol } from './orchestrateSystemBSymbol';
import { createTriggeredSetup } from './lifecycle/systemBLifecycle';

const NOW = 1_700_000_000_000;

describe('orchestrateSystemBSymbol', () => {
  it('creates no setup when there is insufficient candle history', () => {
    const { setup } = orchestrateSystemBSymbol({
      symbol: 'SOLUSDT',
      price: 100,
      candles1h: makeCandlesFromCloses(makeTrendingCloses(100, 1, 5), { volume: 10 }),
      now: NOW,
      existing: null,
      origin: 'live',
    });
    expect(setup).toBeNull();
  });

  it('creates a fresh LONG entry_triggered setup once all 3 buy Supertrend instances agree, with volume', () => {
    const candles = makeCandlesFromCloses(makeTrendingCloses(100, 2, 80), { volume: 50 });
    const { setup } = orchestrateSystemBSymbol({
      symbol: 'SOLUSDT',
      price: candles.at(-1)!.close,
      candles1h: candles,
      now: NOW,
      existing: null,
      origin: 'live',
    });
    expect(setup).not.toBeNull();
    expect(setup!.direction).toBe('LONG');
    expect(setup!.status).toBe('entry_triggered');
  });

  it('produces no setup when no candle satisfies the triple-confirmation entry condition', () => {
    // Flat/choppy series: Supertrend instances should not agree on one direction.
    const closes = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i / 2) * 3);
    const candles = makeCandlesFromCloses(closes, { volume: 50 });
    const { setup } = orchestrateSystemBSymbol({
      symbol: 'SOLUSDT',
      price: candles.at(-1)!.close,
      candles1h: candles,
      now: NOW,
      existing: null,
      origin: 'live',
    });
    expect(setup).toBeNull();
  });

  it('advances an existing setup rather than re-detecting a fresh entry', () => {
    const existing = createTriggeredSetup('SOLUSDT', 'LONG', 100, NOW - 3_600_000, 'live');
    const candles = makeCandlesFromCloses(makeTrendingCloses(100, 2, 80), { volume: 50 });
    const { setup } = orchestrateSystemBSymbol({
      symbol: 'SOLUSDT',
      price: 101,
      candles1h: candles,
      now: NOW,
      existing,
      origin: 'live',
    });
    expect(setup!.status).toBe('active');
  });

  it('passes a closed setup through untouched', () => {
    const closed = { ...createTriggeredSetup('SOLUSDT', 'LONG', 100, NOW - 3_600_000, 'live'), status: 'closed' as const, closedReason: 'roi' as const, closedAt: NOW, closedPrice: 110 };
    const candles = makeCandlesFromCloses(makeTrendingCloses(100, 2, 80), { volume: 50 });
    const { setup } = orchestrateSystemBSymbol({
      symbol: 'SOLUSDT',
      price: 110,
      candles1h: candles,
      now: NOW,
      existing: closed,
      origin: 'live',
    });
    expect(setup).toBe(closed);
  });
});
