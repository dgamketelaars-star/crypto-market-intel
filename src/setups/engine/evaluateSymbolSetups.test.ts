import { describe, expect, it } from 'vitest';
import { makeCandlesFromCloses } from '../../analysis/testUtils/fixtures';
import {
  makeMomentum,
  makeStructure,
  makeSymbolAnalysis,
  makeTimeframe,
  makeTrend,
  makeVolatility,
  makeVolume,
  makeZone,
} from '../testUtils/analysisFixtures';
import { makeGeneratedSetup } from '../testUtils/setupFixtures';
import { evaluateSymbolSetups } from './evaluateSymbolSetups';

const NOW = 1_700_000_000_000;

function bullishBreakoutAnalysis() {
  return makeSymbolAnalysis({
    symbol: 'TESTUSDT',
    timeframes: {
      '1h': makeTimeframe(
        {
          trend: makeTrend({ priceVsEma20Pct: 2, priceVsEma50Pct: 4, emaAlignment: 'bullish' }, '1h'),
          momentum: makeMomentum({ classification: 'neutral' }, '1h'),
          volatility: makeVolatility({ atr14: { value: 1, timeframe: '1h', sufficientData: true, dataTimestamp: NOW, calculatedAt: NOW } }, '1h'),
          structure: makeStructure({ nearestResistance: makeZone(105, 'resistance'), signal: 'none' }, '1h'),
        },
        '1h',
      ),
      '4h': makeTimeframe({ trend: makeTrend({ classification: 'uptrend', emaAlignment: 'bullish' }, '4h') }, '4h'),
      '1d': makeTimeframe({ trend: makeTrend({ classification: 'uptrend' }, '1d') }, '1d'),
    },
    volume: makeVolume({ classification: 'spike', relativeVolume: 4 }),
  });
}

const candles = makeCandlesFromCloses(Array.from({ length: 40 }, (_, i) => 100 + i * 0.1));

describe('evaluateSymbolSetups', () => {
  it('creates a new setup when a family newly fires for a symbol with no existing setups', () => {
    const { setups } = evaluateSymbolSetups({
      symbol: 'TESTUSDT',
      price: 106.5,
      analysis: bullishBreakoutAnalysis(),
      candles1h: candles,
      btcAnalysis: null,
      ethAnalysis: null,
      now: NOW,
      existingForSymbol: [],
      origin: 'live',
    });
    const breakout = setups.find((s) => s.family === 'trend_continuation_breakout' && s.direction === 'LONG');
    expect(breakout).toBeDefined();
    expect(breakout?.status).toBe('active');
  });

  it('never shows both LONG and SHORT active for the same symbol at once', () => {
    const { setups } = evaluateSymbolSetups({
      symbol: 'TESTUSDT',
      price: 106.5,
      analysis: bullishBreakoutAnalysis(),
      candles1h: candles,
      btcAnalysis: null,
      ethAnalysis: null,
      now: NOW,
      existingForSymbol: [],
      origin: 'live',
    });
    const activeDirections = new Set(setups.filter((s) => s.status === 'active').map((s) => s.direction));
    expect(activeDirections.size).toBeLessThanOrEqual(1);
  });

  it('updates the existing open setup for the same family+direction instead of duplicating it', () => {
    const first = evaluateSymbolSetups({
      symbol: 'TESTUSDT',
      price: 106.5,
      analysis: bullishBreakoutAnalysis(),
      candles1h: candles,
      btcAnalysis: null,
      ethAnalysis: null,
      now: NOW,
      existingForSymbol: [],
      origin: 'live',
    });

    const second = evaluateSymbolSetups({
      symbol: 'TESTUSDT',
      price: 107,
      analysis: bullishBreakoutAnalysis(),
      candles1h: candles,
      btcAnalysis: null,
      ethAnalysis: null,
      now: NOW + 1,
      existingForSymbol: first.setups,
      origin: 'live',
    });

    const matching = second.setups.filter((s) => s.family === 'trend_continuation_breakout' && s.direction === 'LONG');
    expect(matching).toHaveLength(1);
    expect(matching[0].id).toBe(first.setups.find((s) => s.family === 'trend_continuation_breakout')?.id);
  });

  it('leaves closed setups untouched (pass-through)', () => {
    const closed = makeGeneratedSetup({ id: 'closed-1', symbol: 'TESTUSDT', status: 'completed' });
    const { setups } = evaluateSymbolSetups({
      symbol: 'TESTUSDT',
      price: 50, // no family conditions match at all
      analysis: makeSymbolAnalysis({ symbol: 'TESTUSDT' }),
      candles1h: makeCandlesFromCloses([50, 50, 50]),
      btcAnalysis: null,
      ethAnalysis: null,
      now: NOW,
      existingForSymbol: [closed],
      origin: 'live',
    });
    expect(setups.find((s) => s.id === 'closed-1')).toEqual(closed);
  });

  it('invalidates an open (non-active) setup once its family stops firing', () => {
    const openSetup = makeGeneratedSetup({
      id: 'open-1',
      symbol: 'TESTUSDT',
      family: 'trend_continuation_breakout',
      direction: 'LONG',
      status: 'candidate',
    });
    const flatAnalysis = makeSymbolAnalysis({ symbol: 'TESTUSDT' });
    const { setups } = evaluateSymbolSetups({
      symbol: 'TESTUSDT',
      price: 100,
      analysis: flatAnalysis,
      candles1h: makeCandlesFromCloses(Array.from({ length: 10 }, () => 100)),
      btcAnalysis: null,
      ethAnalysis: null,
      now: NOW,
      existingForSymbol: [openSetup],
      origin: 'live',
    });
    const updated = setups.find((s) => s.id === 'open-1');
    expect(updated?.status).toBe('invalidated');
  });

  it('keeps evaluating an ACTIVE setup against its frozen levels even if the family no longer fires', () => {
    const active = makeGeneratedSetup({
      id: 'active-1',
      symbol: 'TESTUSDT',
      status: 'active',
      direction: 'LONG',
      invalidation: { price: 95, timeframe: '1h', method: 'm', explanation: 'e' },
      targets: [],
    });
    const { setups } = evaluateSymbolSetups({
      symbol: 'TESTUSDT',
      price: 94, // below invalidation
      analysis: makeSymbolAnalysis({ symbol: 'TESTUSDT' }),
      candles1h: makeCandlesFromCloses(Array.from({ length: 10 }, () => 94)),
      btcAnalysis: null,
      ethAnalysis: null,
      now: NOW,
      existingForSymbol: [active],
      origin: 'live',
    });
    const updated = setups.find((s) => s.id === 'active-1');
    expect(updated?.status).toBe('invalidated');
    expect(updated?.closedReason).toBe('invalidation');
  });

  it('does not activate a new setup for the opposite direction while one direction is already active (stale-safe)', () => {
    const activeLong = makeGeneratedSetup({
      id: 'active-long-1',
      symbol: 'TESTUSDT',
      status: 'active',
      direction: 'LONG',
      family: 'trend_continuation_breakout',
      invalidation: { price: 50, timeframe: '1h', method: 'm', explanation: 'e' },
      targets: [],
    });
    const { setups } = evaluateSymbolSetups({
      symbol: 'TESTUSDT',
      price: 106.5,
      analysis: bullishBreakoutAnalysis(),
      candles1h: candles,
      btcAnalysis: null,
      ethAnalysis: null,
      now: NOW,
      existingForSymbol: [activeLong],
      origin: 'live',
    });
    const activeDirections = new Set(setups.filter((s) => s.status === 'active').map((s) => s.direction));
    expect(activeDirections.size).toBeLessThanOrEqual(1);
    expect(activeDirections.has('LONG')).toBe(true);
  });

  it('skips family evaluation and leaves candidates untouched when priceIsStale, but still evaluates active setups (which also no-op)', () => {
    const active = makeGeneratedSetup({
      id: 'active-1',
      symbol: 'TESTUSDT',
      status: 'active',
      direction: 'LONG',
      invalidation: { price: 50, timeframe: '1h', method: 'm', explanation: 'e' },
      targets: [],
    });
    const candidate = makeGeneratedSetup({
      id: 'candidate-1',
      symbol: 'TESTUSDT',
      status: 'candidate',
      family: 'range_breakout',
      direction: 'SHORT',
    });
    const { setups } = evaluateSymbolSetups({
      symbol: 'TESTUSDT',
      price: 40, // would otherwise hit invalidation (50) for the active LONG
      analysis: bullishBreakoutAnalysis(),
      candles1h: candles,
      btcAnalysis: null,
      ethAnalysis: null,
      now: NOW,
      existingForSymbol: [active, candidate],
      origin: 'live',
      priceIsStale: true,
    });
    expect(setups.find((s) => s.id === 'active-1')).toEqual(active);
    expect(setups.find((s) => s.id === 'candidate-1')).toEqual(candidate);
  });
});
