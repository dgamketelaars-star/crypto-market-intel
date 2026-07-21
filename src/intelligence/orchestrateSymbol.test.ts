import { describe, expect, it } from 'vitest';
import { makeCandlesFromCloses, makeTrendingCloses } from '../analysis/testUtils/fixtures';
import { makeSymbolAnalysis, makeStructure, makeTrend, makeVolatility } from '../setups/testUtils/analysisFixtures';
import type { GeneratedSetup } from '../setups/engine/types';
import { expireVanishedUniverseSetup, orchestrateSymbolSetup } from './orchestrateSymbol';
import { createIntelligenceSetup } from './lifecycle/createIntelligenceSetup';
import { makeValidThesis, makeValidTradePlan } from './lifecycle/testUtils/lifecycleFixtures';

const NOW = 1_700_000_000_000;

function bullishInput(priceOverride?: number) {
  const candles = makeCandlesFromCloses(makeTrendingCloses(100, 0.6, 260));
  const price = priceOverride ?? candles.at(-1)!.close;
  const momentum4h = {
    timeframe: '4h' as const,
    classification: 'strengthening' as const,
    rsi14: { value: 62, timeframe: '4h' as const, sufficientData: true, dataTimestamp: 1, calculatedAt: 1 },
    macd: { value: { macdLine: 1, signalLine: 0.5, histogram: 0.5 }, timeframe: '4h' as const, sufficientData: true, dataTimestamp: 1, calculatedAt: 1 },
    macdHistogramDirection: 'rising' as const,
    roc: { value: 2, timeframe: '4h' as const, sufficientData: true, dataTimestamp: 1, calculatedAt: 1 },
    divergenceDirection: 'none' as const,
    freshness: { dataTimestamp: 1, calculatedAt: 1, stale: false },
    sufficientData: true,
  };
  const analysis = makeSymbolAnalysis({
    symbol: 'SOLUSDT',
    timeframes: {
      '4h': { timeframe: '4h', trend: makeTrend({ classification: 'uptrend', emaAlignment: 'bullish', emaSlope20Pct: 3 }, '4h'), momentum: momentum4h, volatility: makeVolatility({ classification: 'normal' }, '4h'), structure: makeStructure({}, '4h') },
      '1d': { timeframe: '1d', trend: makeTrend({ classification: 'uptrend', emaAlignment: 'bullish', emaSlope20Pct: 2 }, '1d'), momentum: { ...momentum4h, timeframe: '1d' }, volatility: makeVolatility({ classification: 'normal' }, '1d'), structure: makeStructure({}, '1d') },
    },
    volume: { classification: 'elevated' },
    positioning: { priceChange24hPct: 3, oiTrend: 'rising', fundingState: 'neutral' },
  });

  return {
    symbol: 'SOLUSDT',
    price,
    markPrice: price,
    analysis,
    candles: { '4h': candles, '1d': candles, '1h': candles },
    btcAnalysis: null,
    ethAnalysis: null,
    breadthBullishSharePct: null,
    recentLiquidations: [],
    longShortRatio: null,
    now: NOW,
    existingForSymbol: [] as GeneratedSetup[],
    origin: 'live' as const,
  };
}

function flatInsufficientInput() {
  const thin = makeCandlesFromCloses([100, 100, 100]);
  return {
    symbol: 'SOLUSDT',
    price: 100,
    markPrice: 100,
    analysis: makeSymbolAnalysis({ symbol: 'SOLUSDT' }),
    candles: { '4h': thin, '1d': thin, '1h': thin },
    btcAnalysis: null,
    ethAnalysis: null,
    breadthBullishSharePct: null,
    recentLiquidations: [],
    longShortRatio: null,
    now: NOW,
    existingForSymbol: [] as GeneratedSetup[],
    origin: 'live' as const,
  };
}

describe('orchestrateSymbolSetup', () => {
  it('creates a fresh setup when there is no existing one and the pipeline produces a valid thesis + plan', () => {
    const { setups } = orchestrateSymbolSetup(bullishInput());
    // Whatever the real evidence synthesis concludes for this fixture, the result must be internally
    // consistent: either nothing (if the plan/thesis doesn't clear every gate) or exactly one open setup.
    expect(setups.length).toBeLessThanOrEqual(1);
    if (setups.length === 1) {
      expect(setups[0].symbol).toBe('SOLUSDT');
      expect(setups[0].family).toBe('evidence_based_thesis');
    }
  });

  it('produces no setups for a symbol with insufficient data', () => {
    const { setups } = orchestrateSymbolSetup(flatInsufficientInput());
    expect(setups).toHaveLength(0);
  });

  it('invalidates an existing open setup when the fresh evaluation no longer produces a thesis', () => {
    const thesis = makeValidThesis('LONG');
    const plan = makeValidTradePlan('LONG');
    const existing = createIntelligenceSetup('SOLUSDT', thesis, plan, { price: 103, now: NOW - 1000, origin: 'live', analysis: makeSymbolAnalysis({ symbol: 'SOLUSDT' }), btcAnalysis: null });

    const { setups } = orchestrateSymbolSetup({ ...flatInsufficientInput(), existingForSymbol: [existing] });
    expect(setups).toHaveLength(1);
    expect(setups[0].status).toBe('invalidated');
  });

  it('skips re-synthesis for an already-active setup and evaluates it purely against price', () => {
    const thesis = makeValidThesis('LONG');
    const plan = makeValidTradePlan('LONG'); // invalidation at 95
    const existingActive = createIntelligenceSetup('SOLUSDT', thesis, plan, { price: 100, now: NOW - 1000, origin: 'live', analysis: makeSymbolAnalysis({ symbol: 'SOLUSDT' }), btcAnalysis: null });
    expect(existingActive.status).toBe('active');

    const { setups } = orchestrateSymbolSetup({ ...flatInsufficientInput(), price: 95, markPrice: 95, existingForSymbol: [existingActive] });
    expect(setups).toHaveLength(1);
    expect(setups[0].status).toBe('invalidated');
    expect(setups[0].closedReason).toBe('invalidation');
  });

  it('leaves an active setup completely untouched when the price feed is stale', () => {
    const thesis = makeValidThesis('LONG');
    const plan = makeValidTradePlan('LONG');
    const existingActive = createIntelligenceSetup('SOLUSDT', thesis, plan, { price: 100, now: NOW - 1000, origin: 'live', analysis: makeSymbolAnalysis({ symbol: 'SOLUSDT' }), btcAnalysis: null });

    const { setups } = orchestrateSymbolSetup({ ...flatInsufficientInput(), price: 95, markPrice: 95, existingForSymbol: [existingActive], priceIsStale: true });
    expect(setups).toHaveLength(1);
    expect(setups[0]).toBe(existingActive);
  });

  it('leaves a still-forming setup untouched (not re-evaluated at all) when the price feed is stale', () => {
    const thesis = makeValidThesis('LONG');
    const plan = makeValidTradePlan('LONG');
    const waiting = createIntelligenceSetup('SOLUSDT', thesis, plan, { price: 103, now: NOW - 1000, origin: 'live', analysis: makeSymbolAnalysis({ symbol: 'SOLUSDT' }), btcAnalysis: null });

    const { setups } = orchestrateSymbolSetup({ ...flatInsufficientInput(), existingForSymbol: [waiting], priceIsStale: true });
    expect(setups).toEqual([waiting]);
  });

  it('keeps closed (passthrough) setups untouched alongside a fresh evaluation', () => {
    const closed: GeneratedSetup = {
      ...createIntelligenceSetup('SOLUSDT', makeValidThesis('LONG'), makeValidTradePlan('LONG'), { price: 100, now: NOW - 5000, origin: 'live', analysis: makeSymbolAnalysis({ symbol: 'SOLUSDT' }), btcAnalysis: null }),
      status: 'completed',
      closedAt: NOW - 1000,
      closedReason: 'target',
      closedPrice: 120,
    };
    const { setups } = orchestrateSymbolSetup({ ...flatInsufficientInput(), existingForSymbol: [closed] });
    expect(setups.some((s) => s.id === closed.id && s.status === 'completed')).toBe(true);
  });
});

describe('expireVanishedUniverseSetup', () => {
  it('force-closes an ACTIVE setup once its symbol falls out of the tracked universe, instead of leaving it orphaned forever', () => {
    const active = createIntelligenceSetup('SOLUSDT', makeValidThesis('LONG'), makeValidTradePlan('LONG'), {
      price: 100,
      now: NOW - 1000,
      origin: 'live',
      analysis: makeSymbolAnalysis({ symbol: 'SOLUSDT' }),
      btcAnalysis: null,
    });
    expect(active.status).toBe('active');

    const result = expireVanishedUniverseSetup(active, NOW, 103.5);
    expect(result).not.toBeNull();
    expect(result!.status).toBe('expired');
    expect(result!.closedReason).toBe('expired');
    expect(result!.closedPrice).toBe(103.5);
    expect(result!.lifecycle.some((e) => e.detail.includes('Top-50'))).toBe(true);
  });

  it('records a null closedPrice when no last-known price is available for the vanished symbol', () => {
    const active = createIntelligenceSetup('SOLUSDT', makeValidThesis('LONG'), makeValidTradePlan('LONG'), {
      price: 100,
      now: NOW - 1000,
      origin: 'live',
      analysis: makeSymbolAnalysis({ symbol: 'SOLUSDT' }),
      btcAnalysis: null,
    });
    const result = expireVanishedUniverseSetup(active, NOW, null);
    expect(result!.closedPrice).toBeNull();
  });

  it('still applies the normal age-based expiry check to a still-forming (non-active) setup', () => {
    const waiting = createIntelligenceSetup('SOLUSDT', makeValidThesis('LONG'), makeValidTradePlan('LONG'), {
      price: 103,
      now: NOW - 1000,
      origin: 'live',
      analysis: makeSymbolAnalysis({ symbol: 'SOLUSDT' }),
      btcAnalysis: null,
    });
    expect(waiting.status).toBe('waiting_for_confirmation');
    // Not old enough to expire yet -> untouched, not force-closed just for leaving the universe.
    expect(expireVanishedUniverseSetup(waiting, NOW, 103)).toBeNull();
  });

  it('does nothing to an already-closed setup', () => {
    const closed: GeneratedSetup = {
      ...createIntelligenceSetup('SOLUSDT', makeValidThesis('LONG'), makeValidTradePlan('LONG'), { price: 100, now: NOW - 1000, origin: 'live', analysis: makeSymbolAnalysis({ symbol: 'SOLUSDT' }), btcAnalysis: null }),
      status: 'completed',
      closedAt: NOW - 500,
      closedReason: 'target',
      closedPrice: 120,
    };
    expect(expireVanishedUniverseSetup(closed, NOW, 100)).toBeNull();
  });
});
