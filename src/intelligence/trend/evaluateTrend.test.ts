import { describe, expect, it } from 'vitest';
import { makeTrend } from '../../setups/testUtils/analysisFixtures';
import { makeCandlesFromCloses, makeTrendingCloses } from '../../analysis/testUtils/fixtures';
import { evaluateTrend } from './evaluateTrend';

describe('evaluateTrend', () => {
  it('returns insufficient_data when the trend analysis is not sufficient', () => {
    const trend = makeTrend({ sufficientData: false, classification: 'insufficient_data' }, '4h');
    const result = evaluateTrend(trend, [], 1);
    expect(result.conclusion).toBe('insufficient_data');
  });

  it('concludes bullish for a clean, non-compressed bullish alignment in an uptrend', () => {
    const candles = makeCandlesFromCloses(makeTrendingCloses(100, 0.8, 260));
    const trend = makeTrend({ classification: 'uptrend', emaAlignment: 'bullish', emaSlope20Pct: 3 }, '4h');
    const result = evaluateTrend(trend, candles, 1);
    expect(result.conclusion).toBe('bullish');
  });

  it('concludes bearish for a clean, non-compressed bearish alignment in a downtrend', () => {
    const candles = makeCandlesFromCloses(makeTrendingCloses(300, -0.8, 260));
    const trend = makeTrend({ classification: 'downtrend', emaAlignment: 'bearish', emaSlope20Pct: -3 }, '4h');
    const result = evaluateTrend(trend, candles, 1);
    expect(result.conclusion).toBe('bearish');
  });

  it('downgrades to slightly_bullish when the trend is bullish but mid-transition', () => {
    const candles = makeCandlesFromCloses(makeTrendingCloses(100, 0.2, 260));
    const trend = makeTrend({ classification: 'transition', emaAlignment: 'bullish' }, '4h');
    const result = evaluateTrend(trend, candles, 1);
    expect(result.conclusion).toBe('slightly_bullish');
  });

  it('concludes neutral for a flat/sideways market', () => {
    const candles = makeCandlesFromCloses(Array.from({ length: 260 }, () => 100));
    const trend = makeTrend({ classification: 'sideways', emaAlignment: 'mixed' }, '4h');
    const result = evaluateTrend(trend, candles, 1);
    expect(result.conclusion).toBe('neutral');
  });

  it('downgrades to slightly_bullish when EMAs are tightly compressed despite a bullish uptrend read', () => {
    // Flat candle history -> a freshly computed EMA100 also lands near 100, tightly matching the fixture's EMA20/50/200.
    const candles = makeCandlesFromCloses(Array.from({ length: 260 }, () => 100));
    const trend = makeTrend(
      { classification: 'uptrend', emaAlignment: 'bullish', emaSlope20Pct: 0.1, ema20: { value: 101, timeframe: '4h', sufficientData: true, dataTimestamp: 1, calculatedAt: 1 }, ema50: { value: 100.8, timeframe: '4h', sufficientData: true, dataTimestamp: 1, calculatedAt: 1 }, ema200: { value: 100.5, timeframe: '4h', sufficientData: true, dataTimestamp: 1, calculatedAt: 1 } },
      '4h',
    );
    const result = evaluateTrend(trend, candles, 1);
    expect(result.conclusion).toBe('slightly_bullish');
  });
});
