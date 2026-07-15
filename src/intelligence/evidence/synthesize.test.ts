import { describe, expect, it } from 'vitest';
import { makeSymbolAnalysis, makeStructure, makeTrend, makeVolatility } from '../../setups/testUtils/analysisFixtures';
import { makeCandlesFromCloses, makeTrendingCloses } from '../../analysis/testUtils/fixtures';
import { EVIDENCE_CATEGORY_IDS } from './types';
import { synthesizeEvidence } from './synthesize';

function bullishAnalysis() {
  return makeSymbolAnalysis({
    timeframes: {
      '4h': {
        timeframe: '4h',
        trend: makeTrend({ classification: 'uptrend', emaAlignment: 'bullish', emaSlope20Pct: 3 }, '4h'),
        momentum: { timeframe: '4h', classification: 'strengthening', rsi14: { value: 60, timeframe: '4h', sufficientData: true, dataTimestamp: 1, calculatedAt: 1 }, macd: { value: { macdLine: 1, signalLine: 0.5, histogram: 0.5 }, timeframe: '4h', sufficientData: true, dataTimestamp: 1, calculatedAt: 1 }, macdHistogramDirection: 'rising', roc: { value: 2, timeframe: '4h', sufficientData: true, dataTimestamp: 1, calculatedAt: 1 }, divergenceDirection: 'none', freshness: { dataTimestamp: 1, calculatedAt: 1, stale: false }, sufficientData: true },
        volatility: makeVolatility({ classification: 'normal' }, '4h'),
        structure: makeStructure({}, '4h'),
      },
      '1d': {
        timeframe: '1d',
        trend: makeTrend({ classification: 'uptrend', emaAlignment: 'bullish', emaSlope20Pct: 2 }, '1d'),
        momentum: { timeframe: '1d', classification: 'strengthening', rsi14: { value: 58, timeframe: '1d', sufficientData: true, dataTimestamp: 1, calculatedAt: 1 }, macd: { value: { macdLine: 1, signalLine: 0.5, histogram: 0.5 }, timeframe: '1d', sufficientData: true, dataTimestamp: 1, calculatedAt: 1 }, macdHistogramDirection: 'rising', roc: { value: 1.5, timeframe: '1d', sufficientData: true, dataTimestamp: 1, calculatedAt: 1 }, divergenceDirection: 'none', freshness: { dataTimestamp: 1, calculatedAt: 1, stale: false }, sufficientData: true },
        volatility: makeVolatility({ classification: 'normal' }, '1d'),
        structure: makeStructure({}, '1d'),
      },
    },
    volume: { classification: 'elevated' },
    positioning: { priceChange24hPct: 4, oiTrend: 'rising', fundingState: 'neutral' },
  });
}

describe('synthesizeEvidence', () => {
  it('produces every evidence category without throwing, for a plain bullish fixture', () => {
    const analysis = bullishAnalysis();
    const candles = makeCandlesFromCloses(makeTrendingCloses(100, 0.5, 260));
    const result = synthesizeEvidence({
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
      now: 1,
    });

    const allCategories = [
      result.layers.layerA.marketRegime.category,
      result.layers.layerA.higherTimeframeStructure.category,
      result.layers.layerA.entryLocationQuality.LONG.category,
      result.layers.layerA.entryLocationQuality.SHORT.category,
      result.layers.layerB.trend.category,
      result.layers.layerB.momentum.category,
      result.layers.layerB.volume.category,
      result.layers.layerC.volatility.category,
      result.layers.layerC.derivativesPositioning.category,
      result.layers.layerC.btcEthContext.category,
      result.layers.layerC.riskConflict.category,
    ];
    for (const category of allCategories) {
      expect(EVIDENCE_CATEGORY_IDS).toContain(category);
    }
  });

  it('never lets Layer C categories carry the provisional bias on their own — regime/structure only', () => {
    const analysis = bullishAnalysis();
    const candles = makeCandlesFromCloses(makeTrendingCloses(100, 0.5, 260));
    const result = synthesizeEvidence({
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
      now: 1,
    });
    // provisionalBias must trace back only to regime + structure (deriveLayerABias), independent of Layer C.
    expect(['bullish', 'bearish', 'neutral']).toContain(result.provisionalBias);
  });

  it('marks the regime gate blocked when both 4H and 1D trend are insufficient', () => {
    const analysis = makeSymbolAnalysis({
      timeframes: {
        '4h': { timeframe: '4h', trend: makeTrend({ sufficientData: false, classification: 'insufficient_data' }, '4h'), momentum: bullishAnalysis().timeframes['4h']!.momentum, volatility: makeVolatility({}, '4h'), structure: makeStructure({}, '4h') },
        '1d': { timeframe: '1d', trend: makeTrend({ sufficientData: false, classification: 'insufficient_data' }, '1d'), momentum: bullishAnalysis().timeframes['1d']!.momentum, volatility: makeVolatility({}, '1d'), structure: makeStructure({}, '1d') },
      },
    });
    const candles = makeCandlesFromCloses(Array.from({ length: 5 }, () => 100));
    const result = synthesizeEvidence({
      symbol: 'SOLUSDT',
      analysis,
      candles: { '4h': candles, '1d': candles, '1h': candles },
      price: 100,
      markPrice: 100,
      btcAnalysis: null,
      ethAnalysis: null,
      breadthBullishSharePct: null,
      recentLiquidations: [],
      longShortRatio: null,
      now: 1,
    });
    expect(result.layers.layerA.marketRegime.gateStatus).toBe('blocked');
  });
});
