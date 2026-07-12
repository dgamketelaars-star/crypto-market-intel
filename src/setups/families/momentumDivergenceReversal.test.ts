import { describe, expect, it } from 'vitest';
import { makeCandlesFromCloses } from '../../analysis/testUtils/fixtures';
import { makeMomentum, makeSymbolAnalysis, makeTimeframe, makeTrend, makeVolatility } from '../testUtils/analysisFixtures';
import type { FamilyEvaluationInput } from './shared';
import { momentumDivergenceReversal } from './momentumDivergenceReversal';

const NOW = 1_700_000_000_000;
const candles = makeCandlesFromCloses(Array.from({ length: 40 }, (_, i) => 100 - i * 0.05));

function bullishDivergenceInput(): FamilyEvaluationInput {
  const analysis = makeSymbolAnalysis({
    timeframes: {
      '1h': makeTimeframe(
        {
          trend: makeTrend({ classification: 'downtrend', emaAlignment: 'bearish' }, '1h'),
          momentum: makeMomentum({ classification: 'diverging', divergenceDirection: 'bullish_divergence', macdHistogramDirection: 'rising' }, '1h'),
          volatility: makeVolatility({}, '1h'),
        },
        '1h',
      ),
    },
  });
  const lastCandle = candles[candles.length - 1];
  candles[candles.length - 1] = { ...lastCandle, open: lastCandle.close - 1, close: lastCandle.close + 0.5, isFinal: true };
  return { symbol: 'TESTUSDT', price: candles[candles.length - 1].close, analysis, candles1h: candles, btcAnalysis: null, ethAnalysis: null, now: NOW };
}

describe('momentumDivergenceReversal', () => {
  it('returns null when momentum is not classified as diverging', () => {
    const input = bullishDivergenceInput();
    input.analysis.timeframes['1h']!.momentum = makeMomentum({ classification: 'neutral' }, '1h');
    expect(momentumDivergenceReversal.evaluate(input)).toBeNull();
  });

  it('detects a LONG candidate/confirmation on bullish divergence against a prior downtrend', () => {
    const results = momentumDivergenceReversal.evaluate(bullishDivergenceInput());
    const long = results?.find((r) => r.direction === 'LONG');
    expect(long).toBeDefined();
    expect(['candidate', 'waiting_for_confirmation', 'active_ready']).toContain(long?.readiness);
  });

  it('is symmetrical: bearish divergence against a prior uptrend produces a SHORT, not a LONG', () => {
    const analysis = makeSymbolAnalysis({
      timeframes: {
        '1h': makeTimeframe(
          {
            trend: makeTrend({ classification: 'uptrend', emaAlignment: 'bullish' }, '1h'),
            momentum: makeMomentum({ classification: 'diverging', divergenceDirection: 'bearish_divergence', macdHistogramDirection: 'falling' }, '1h'),
            volatility: makeVolatility({}, '1h'),
          },
          '1h',
        ),
      },
    });
    const bearishCandles = makeCandlesFromCloses(Array.from({ length: 40 }, (_, i) => 100 + i * 0.05));
    const last = bearishCandles[bearishCandles.length - 1];
    bearishCandles[bearishCandles.length - 1] = { ...last, open: last.close + 1, close: last.close - 0.5, isFinal: true };

    const input: FamilyEvaluationInput = {
      symbol: 'TESTUSDT',
      price: bearishCandles[bearishCandles.length - 1].close,
      analysis,
      candles1h: bearishCandles,
      btcAnalysis: null,
      ethAnalysis: null,
      now: NOW,
    };
    const results = momentumDivergenceReversal.evaluate(input);
    expect(results?.some((r) => r.direction === 'SHORT')).toBe(true);
    expect(results?.some((r) => r.direction === 'LONG')).toBe(false);
  });
});
