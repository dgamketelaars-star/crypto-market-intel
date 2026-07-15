import { describe, expect, it } from 'vitest';
import { makeCandle, makeCandlesFromCloses, makeTrendingCloses } from '../../analysis/testUtils/fixtures';
import { makeSymbolAnalysis, makeStructure, makeTrend, makeVolatility } from '../../setups/testUtils/analysisFixtures';
import { synthesizeEvidence } from '../evidence/synthesize';
import { decideThesis } from './decisionFlow';

/** End-to-end: real evidence synthesis (Phase 2) feeding the real decision flow (Phase 3), no hand-built fixtures in between. */
describe('synthesizeEvidence -> decideThesis pipeline', () => {
  it('produces a deterministic, non-crashing outcome for a plain trending market', () => {
    const candles = makeCandlesFromCloses(makeTrendingCloses(100, 0.6, 260));
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

    const synthesis = synthesizeEvidence({
      symbol: 'SOLUSDT',
      analysis,
      candles: { '4h': candles, '1d': candles, '1h': candles },
      price: candles.at(-1)!.close,
      markPrice: candles.at(-1)!.close,
      btcAnalysis: null,
      ethAnalysis: null,
      breadthBullishSharePct: null,
      recentLiquidations: [],
      longShortRatio: null,
      now: Date.now(),
    });

    const result = decideThesis('SOLUSDT', synthesis);
    expect(['VALID_LONG_THESIS', 'VALID_SHORT_THESIS', 'NO_THESIS']).toContain(result.outcome);
    // Whatever the outcome, it must be internally consistent: a valid thesis always carries a narrative and signal strength.
    if (result.outcome !== 'NO_THESIS') {
      expect(result.narrative.length).toBeGreaterThan(0);
      expect(['Medium', 'High', 'Very high']).toContain(result.signalStrength);
    } else {
      expect(result.detail.length).toBeGreaterThan(0);
    }
  });

  it('returns NO_THESIS for a flat, directionless market with no candle history at all', () => {
    const thin = [makeCandle({ close: 100 }, 0)];
    const analysis = makeSymbolAnalysis({ symbol: 'SOLUSDT' });
    const synthesis = synthesizeEvidence({
      symbol: 'SOLUSDT',
      analysis,
      candles: { '4h': thin, '1d': thin, '1h': thin },
      price: 100,
      markPrice: 100,
      btcAnalysis: null,
      ethAnalysis: null,
      breadthBullishSharePct: null,
      recentLiquidations: [],
      longShortRatio: null,
      now: Date.now(),
    });
    const result = decideThesis('SOLUSDT', synthesis);
    expect(result.outcome).toBe('NO_THESIS');
  });
});
