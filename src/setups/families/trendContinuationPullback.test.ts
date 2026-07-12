import { describe, expect, it } from 'vitest';
import { makeCandlesFromCloses } from '../../analysis/testUtils/fixtures';
import { makeMomentum, makeStructure, makeSymbolAnalysis, makeTimeframe, makeTrend, makeVolatility } from '../testUtils/analysisFixtures';
import type { FamilyEvaluationInput } from './shared';
import { trendContinuationPullback } from './trendContinuationPullback';

const NOW = 1_700_000_000_000;

function pullbackInput(): FamilyEvaluationInput {
  const analysis = makeSymbolAnalysis({
    timeframes: {
      '1h': makeTimeframe(
        {
          trend: makeTrend({ ema20: { value: 100, timeframe: '1h', sufficientData: true, dataTimestamp: NOW, calculatedAt: NOW }, ema50: { value: 90, timeframe: '1h', sufficientData: true, dataTimestamp: NOW, calculatedAt: NOW } }, '1h'),
          momentum: makeMomentum({ classification: 'strengthening' }, '1h'),
          volatility: makeVolatility({ atr14: { value: 2, timeframe: '1h', sufficientData: true, dataTimestamp: NOW, calculatedAt: NOW } }, '1h'),
          structure: makeStructure({ signal: 'none' }, '1h'),
        },
        '1h',
      ),
      '4h': makeTimeframe({ trend: makeTrend({ classification: 'uptrend' }, '4h') }, '4h'),
    },
    volume: { classification: 'normal' },
  });
  return {
    symbol: 'TESTUSDT',
    price: 100.5, // just reclaimed EMA20 (100) with the small buffer
    analysis,
    candles1h: makeCandlesFromCloses(Array.from({ length: 30 }, () => 100)),
    btcAnalysis: null,
    ethAnalysis: null,
    now: NOW,
  };
}

describe('trendContinuationPullback', () => {
  it('returns null without a confirmed 4H trend', () => {
    const input = pullbackInput();
    input.analysis.timeframes['4h'] = undefined;
    expect(trendContinuationPullback.evaluate(input)).toBeNull();
  });

  it('returns null when price is far from EMA20 (not a pullback)', () => {
    const input = pullbackInput();
    input.price = 130;
    expect(trendContinuationPullback.evaluate(input)?.find((r) => r.direction === 'LONG')).toBeUndefined();
  });

  it('detects an active-ready LONG once price reclaims EMA20 with momentum and volume support', () => {
    const results = trendContinuationPullback.evaluate(pullbackInput());
    const long = results?.find((r) => r.direction === 'LONG');
    expect(long).toBeDefined();
    expect(long?.readiness).toBe('active_ready');
  });
});
