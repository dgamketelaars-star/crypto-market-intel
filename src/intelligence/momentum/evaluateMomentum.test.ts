import { describe, expect, it } from 'vitest';
import { makeMomentum } from '../../setups/testUtils/analysisFixtures';
import { makeCandle, zigzagCandlesWithVolume } from '../../analysis/testUtils/fixtures';
import { evaluateMomentum } from './evaluateMomentum';

function candlesRisingIntoStrength(): ReturnType<typeof makeCandle>[] {
  return Array.from({ length: 20 }, (_, i) => makeCandle({ close: 100 + i * 2 }, i));
}

function candlesFallingIntoWeakness(): ReturnType<typeof makeCandle>[] {
  return Array.from({ length: 20 }, (_, i) => makeCandle({ close: 200 - i * 2 }, i));
}

describe('evaluateMomentum', () => {
  it('returns insufficient_data when the momentum analysis is not sufficient', () => {
    const momentum = makeMomentum({ sufficientData: false, classification: 'insufficient_data' }, '1h');
    expect(evaluateMomentum(momentum, [], 1).conclusion).toBe('insufficient_data');
  });

  it('prioritizes divergence over the raw classification, reading bullish divergence as slightly_bullish', () => {
    const momentum = makeMomentum({ classification: 'diverging', divergenceDirection: 'bullish_divergence' }, '1h');
    const result = evaluateMomentum(momentum, candlesFallingIntoWeakness(), 1);
    expect(result.conclusion).toBe('slightly_bullish');
  });

  it('reads bearish divergence as slightly_bearish', () => {
    const momentum = makeMomentum({ classification: 'diverging', divergenceDirection: 'bearish_divergence' }, '1h');
    const result = evaluateMomentum(momentum, candlesRisingIntoStrength(), 1);
    expect(result.conclusion).toBe('slightly_bearish');
  });

  it('concludes bullish for strengthening momentum with RSI above 50', () => {
    const momentum = makeMomentum({ classification: 'strengthening', rsi14: { value: 62, timeframe: '1h', sufficientData: true, dataTimestamp: 1, calculatedAt: 1 } }, '1h');
    const result = evaluateMomentum(momentum, candlesRisingIntoStrength(), 1);
    expect(result.conclusion).toBe('bullish');
  });

  it('concludes bearish for weakening momentum with RSI below 50', () => {
    const momentum = makeMomentum({ classification: 'weakening', rsi14: { value: 38, timeframe: '1h', sufficientData: true, dataTimestamp: 1, calculatedAt: 1 } }, '1h');
    const result = evaluateMomentum(momentum, candlesFallingIntoWeakness(), 1);
    expect(result.conclusion).toBe('bearish');
  });

  it('concludes neutral for a neutral classification', () => {
    const momentum = makeMomentum({ classification: 'neutral' }, '1h');
    const result = evaluateMomentum(momentum, candlesRisingIntoStrength(), 1);
    expect(result.conclusion).toBe('neutral');
  });

  it('adds a supporting Weis wave fact when it agrees with the strengthening classification', () => {
    // Up-wave 2 (104 -> 130) makes far more progress on far less volume than up-wave 1 (98 -> 110) -> "strengthening".
    const candles = zigzagCandlesWithVolume([105, 98, 110, 104, 130, 126], [10, 1000, 10, 100, 10]);
    const momentum = makeMomentum({ classification: 'strengthening', rsi14: { value: 62, timeframe: '1h', sufficientData: true, dataTimestamp: 1, calculatedAt: 1 } }, '1h');
    const result = evaluateMomentum(momentum, candles, 1);
    expect(result.supporting.some((f) => f.description.includes('Weis wave'))).toBe(true);
    expect(result.opposing.some((f) => f.description.includes('Weis wave'))).toBe(false);
  });

  it('adds an opposing Weis wave fact when it conflicts with the classification', () => {
    // Up-wave 2 (118 -> 121) makes far less progress on far more volume than up-wave 1 (98 -> 122) -> "weakening",
    // directly conflicting with an RSI/MACD-based "strengthening" read.
    const candles = zigzagCandlesWithVolume([105, 98, 122, 118, 121, 120.5], [10, 20, 10, 2000, 10]);
    const momentum = makeMomentum({ classification: 'strengthening', rsi14: { value: 62, timeframe: '1h', sufficientData: true, dataTimestamp: 1, calculatedAt: 1 } }, '1h');
    const result = evaluateMomentum(momentum, candles, 1);
    expect(result.opposing.some((f) => f.description.includes('Weis wave'))).toBe(true);
    // The conflicting Weis read is a caution, not an override — the conclusion still follows RSI/MACD.
    expect(result.conclusion).toBe('bullish');
  });
});
