import { describe, expect, it } from 'vitest';
import { makeCandlesFromCloses } from '../../analysis/testUtils/fixtures';
import { makeMomentum, makeStructure, makeSymbolAnalysis, makeTimeframe, makeVolatility, makeZone } from '../testUtils/analysisFixtures';
import type { FamilyEvaluationInput } from './shared';
import { failedBreakoutReversal } from './failedBreakoutReversal';

const NOW = 1_700_000_000_000;

describe('failedBreakoutReversal', () => {
  it('returns null when 1H data is insufficient', () => {
    const analysis = makeSymbolAnalysis({
      timeframes: { '1h': makeTimeframe({ trend: { ...makeTimeframe({}, '1h').trend, sufficientData: false } }, '1h') },
    });
    const input: FamilyEvaluationInput = {
      symbol: 'TESTUSDT',
      price: 100,
      analysis,
      candles1h: makeCandlesFromCloses([100, 100, 100]),
      btcAnalysis: null,
      ethAnalysis: null,
      now: NOW,
    };
    expect(failedBreakoutReversal.evaluate(input)).toBeNull();
  });

  it('detects a SHORT candidate on a failed_breakout signal from the analysis engine', () => {
    const analysis = makeSymbolAnalysis({
      timeframes: {
        '1h': makeTimeframe(
          {
            structure: makeStructure({ signal: 'failed_breakout', nearestResistance: makeZone(110, 'resistance') }, '1h'),
            momentum: makeMomentum({ classification: 'weakening' }, '1h'),
            volatility: makeVolatility({ atr14: { value: 1, timeframe: '1h', sufficientData: true, dataTimestamp: NOW, calculatedAt: NOW } }, '1h'),
          },
          '1h',
        ),
      },
      volume: { classification: 'normal' },
    });
    const candles = makeCandlesFromCloses(Array.from({ length: 30 }, () => 108));
    const input: FamilyEvaluationInput = {
      symbol: 'TESTUSDT',
      price: 108,
      analysis,
      candles1h: candles,
      btcAnalysis: null,
      ethAnalysis: null,
      now: NOW,
    };
    const results = failedBreakoutReversal.evaluate(input);
    expect(results?.some((r) => r.direction === 'SHORT')).toBe(true);
  });
});
