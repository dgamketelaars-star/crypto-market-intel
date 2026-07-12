import { describe, expect, it } from 'vitest';
import { makeCandlesFromCloses } from '../../analysis/testUtils/fixtures';
import { makeMomentum, makeStructure, makeSymbolAnalysis, makeTimeframe, makeTrend, makeVolatility, makeZone } from '../testUtils/analysisFixtures';
import type { FamilyEvaluationInput } from './shared';
import { rangeBreakout } from './rangeBreakout';

const NOW = 1_700_000_000_000;

function rangeInput(): FamilyEvaluationInput {
  const analysis = makeSymbolAnalysis({
    timeframes: {
      '1h': makeTimeframe(
        {
          trend: makeTrend({ classification: 'sideways' }, '1h'),
          momentum: makeMomentum({ classification: 'neutral' }, '1h'),
          volatility: makeVolatility({ atr14: { value: 1, timeframe: '1h', sufficientData: true, dataTimestamp: NOW, calculatedAt: NOW } }, '1h'),
          structure: makeStructure(
            { nearestSupport: makeZone(95, 'support'), nearestResistance: makeZone(105, 'resistance'), signal: 'breakout_candidate' },
            '1h',
          ),
        },
        '1h',
      ),
    },
    volume: { classification: 'spike', relativeVolume: 3.5 },
  });
  return {
    symbol: 'TESTUSDT',
    price: 106.5,
    analysis,
    candles1h: makeCandlesFromCloses(Array.from({ length: 30 }, () => 104)),
    btcAnalysis: null,
    ethAnalysis: null,
    now: NOW,
  };
}

describe('rangeBreakout', () => {
  it('returns null when the 1H trend is not classified as sideways', () => {
    const input = rangeInput();
    input.analysis.timeframes['1h']!.trend = makeTrend({ classification: 'uptrend' }, '1h');
    expect(rangeBreakout.evaluate(input)).toBeNull();
  });

  it('returns null when only one side of the range is defined', () => {
    const input = rangeInput();
    input.analysis.timeframes['1h']!.structure.nearestSupport = null;
    expect(rangeBreakout.evaluate(input)).toBeNull();
  });

  it('detects an active-ready LONG breakout above the range top with confirming volume', () => {
    const results = rangeBreakout.evaluate(rangeInput());
    const long = results?.find((r) => r.direction === 'LONG');
    expect(long).toBeDefined();
    expect(long?.readiness).toBe('active_ready');
  });
});
