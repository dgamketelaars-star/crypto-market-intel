import { describe, expect, it } from 'vitest';
import { makeMomentum } from '../../setups/testUtils/analysisFixtures';
import { makeCandle } from '../../analysis/testUtils/fixtures';
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
});
