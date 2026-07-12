import { describe, expect, it } from 'vitest';
import { makeCandlesFromCloses } from '../../analysis/testUtils/fixtures';
import { makeMomentum, makeStructure, makeSymbolAnalysis, makeTimeframe, makeTrend, makeVolatility } from '../testUtils/analysisFixtures';
import type { FamilyEvaluationInput } from './shared';
import { volatilityCompressionBreakout } from './volatilityCompressionBreakout';

const NOW = 1_700_000_000_000;
const RANGE_CANDLES = makeCandlesFromCloses(Array.from({ length: 25 }, () => 100));

function compressionInput(): FamilyEvaluationInput {
  const analysis = makeSymbolAnalysis({
    timeframes: {
      '1h': makeTimeframe(
        {
          trend: makeTrend({ emaAlignment: 'bullish' }, '1h'),
          momentum: makeMomentum({}, '1h'),
          volatility: makeVolatility({ atr14: { value: 1, timeframe: '1h', sufficientData: true, dataTimestamp: NOW, calculatedAt: NOW } }, '1h'),
          structure: makeStructure({ signal: 'expansion_after_compression', rangeCompression: true }, '1h'),
        },
        '1h',
      ),
    },
  });
  const candles = [...RANGE_CANDLES];
  const last = candles[candles.length - 1];
  candles[candles.length - 1] = { ...last, close: 103, high: 103.2, low: 100, isFinal: true };
  return { symbol: 'TESTUSDT', price: 103, analysis, candles1h: candles, btcAnalysis: null, ethAnalysis: null, now: NOW };
}

describe('volatilityCompressionBreakout', () => {
  it('returns null without a detected compression or EMA lean', () => {
    const input = compressionInput();
    input.analysis.timeframes['1h']!.structure = makeStructure({ signal: 'none', rangeCompression: false }, '1h');
    input.analysis.timeframes['1h']!.trend = makeTrend({ emaAlignment: 'mixed' }, '1h');
    expect(volatilityCompressionBreakout.evaluate(input)).toBeNull();
  });

  it('returns null when there are not enough candles to define a compression range', () => {
    const input = compressionInput();
    input.candles1h = input.candles1h.slice(-5);
    expect(volatilityCompressionBreakout.evaluate(input)).toBeNull();
  });

  it('detects an active-ready LONG when compression + bullish lean + confirmed expansion align', () => {
    const results = volatilityCompressionBreakout.evaluate(compressionInput());
    const long = results?.find((r) => r.direction === 'LONG');
    expect(long).toBeDefined();
    expect(long?.readiness).toBe('active_ready');
  });
});
