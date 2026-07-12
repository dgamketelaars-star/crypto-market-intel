import { describe, expect, it } from 'vitest';
import { makeCandlesFromCloses } from '../../analysis/testUtils/fixtures';
import {
  makeMomentum,
  makePositioning,
  makeStructure,
  makeSymbolAnalysis,
  makeTimeframe,
  makeTrend,
  makeVolatility,
  makeVolume,
  makeZone,
} from '../testUtils/analysisFixtures';
import { trendContinuationBreakout } from './trendContinuationBreakout';
import type { FamilyEvaluationInput } from './shared';

const NOW = 1_700_000_000_000;

function bullishInput(overrides: Partial<FamilyEvaluationInput> = {}): FamilyEvaluationInput {
  const analysis = makeSymbolAnalysis({
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
    volume: { classification: 'spike', relativeVolume: 4 },
    positioning: { fundingState: 'neutral' },
  });

  return {
    symbol: 'TESTUSDT',
    price: 106.5, // above resistance(105) * 1.0015 buffer
    analysis,
    candles1h: makeCandlesFromCloses(Array.from({ length: 40 }, (_, i) => 100 + i * 0.1)),
    btcAnalysis: null,
    ethAnalysis: null,
    now: NOW,
    ...overrides,
  };
}

describe('trendContinuationBreakout', () => {
  it('returns null when 1H trend data is insufficient', () => {
    const input = bullishInput({
      analysis: makeSymbolAnalysis({
        timeframes: { '1h': makeTimeframe({ trend: makeTrend({ sufficientData: false }, '1h') }, '1h') },
      }),
    });
    expect(trendContinuationBreakout.evaluate(input)).toBeNull();
  });

  it('returns null when there is no resistance zone and not enough candles for a fallback', () => {
    const input = bullishInput({ candles1h: makeCandlesFromCloses([100, 101, 102]) });
    input.analysis.timeframes['1h']!.structure.nearestResistance = null;
    expect(trendContinuationBreakout.evaluate(input)?.find((r) => r.direction === 'LONG')).toBeUndefined();
  });

  it('falls back to a recent-swing-high reference when the structure zone is unavailable', () => {
    const input = bullishInput();
    input.analysis.timeframes['1h']!.structure.nearestResistance = null;
    const long = trendContinuationBreakout.evaluate(input)?.find((r) => r.direction === 'LONG');
    expect(long).toBeDefined();
    expect(long?.trigger.price).toBeGreaterThan(0);
  });

  it('detects an active-ready LONG breakout when context and confirmation both hold', () => {
    const results = trendContinuationBreakout.evaluate(bullishInput());
    const long = results?.find((r) => r.direction === 'LONG');
    expect(long).toBeDefined();
    expect(long?.readiness).toBe('active_ready');
    expect(long?.trigger.price).toBe(105);
  });

  it('downgrades to candidate when confirmation volume is not elevated', () => {
    const input = bullishInput();
    input.analysis.volume = makeVolume({ classification: 'normal', relativeVolume: 1 });
    input.price = 105.2; // just above resistance, not near enough to count as "waiting"
    const long = trendContinuationBreakout.evaluate(input)?.find((r) => r.direction === 'LONG');
    expect(long?.readiness).not.toBe('active_ready');
  });

  it('is symmetrical: detects an active-ready SHORT breakdown under mirrored bearish conditions', () => {
    const analysis = makeSymbolAnalysis({
      symbol: 'TESTUSDT',
      timeframes: {
        '1h': makeTimeframe(
          {
            trend: makeTrend({ priceVsEma20Pct: -2, priceVsEma50Pct: -4, emaAlignment: 'bearish' }, '1h'),
            momentum: makeMomentum({ classification: 'neutral' }, '1h'),
            volatility: makeVolatility({}, '1h'),
            structure: makeStructure({ nearestSupport: makeZone(95, 'support'), signal: 'none' }, '1h'),
          },
          '1h',
        ),
        '4h': makeTimeframe({ trend: makeTrend({ classification: 'downtrend', emaAlignment: 'bearish' }, '4h') }, '4h'),
        '1d': makeTimeframe({ trend: makeTrend({ classification: 'downtrend' }, '1d') }, '1d'),
      },
      volume: { classification: 'spike', relativeVolume: 4 },
      positioning: makePositioning({ fundingState: 'neutral' }),
    });
    const input = bullishInput({ analysis, price: 93.5 });
    const short = trendContinuationBreakout.evaluate(input)?.find((r) => r.direction === 'SHORT');
    expect(short).toBeDefined();
    expect(short?.readiness).toBe('active_ready');
    expect(short?.trigger.price).toBe(95);
  });
});
