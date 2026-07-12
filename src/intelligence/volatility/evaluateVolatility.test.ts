import { describe, expect, it } from 'vitest';
import { makeVolatility } from '../../setups/testUtils/analysisFixtures';
import { makeCandlesFromCloses } from '../../analysis/testUtils/fixtures';
import { evaluateVolatility, isExtremeVolatility } from './evaluateVolatility';

describe('evaluateVolatility', () => {
  it('returns insufficient_data when the volatility analysis is not sufficient', () => {
    const volatility = makeVolatility({ sufficientData: false, classification: 'insufficient_data' }, '1h');
    expect(evaluateVolatility(volatility, [], 1).conclusion).toBe('insufficient_data');
  });

  it('is always neutral when usable — volatility never creates a direction', () => {
    const volatility = makeVolatility({ classification: 'extreme' }, '1h');
    const candles = makeCandlesFromCloses(Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i) * 5));
    expect(evaluateVolatility(volatility, candles, 1).conclusion).toBe('neutral');
  });

  it('flags missing Bollinger data when there is not enough candle history', () => {
    const volatility = makeVolatility({}, '1h');
    const result = evaluateVolatility(volatility, makeCandlesFromCloses([100, 101, 102]), 1);
    expect(result.missingData.length).toBeGreaterThan(0);
  });
});

describe('isExtremeVolatility', () => {
  it('is true only for the extreme classification', () => {
    expect(isExtremeVolatility(makeVolatility({ classification: 'extreme' }))).toBe(true);
    expect(isExtremeVolatility(makeVolatility({ classification: 'elevated' }))).toBe(false);
    expect(isExtremeVolatility(undefined)).toBe(false);
  });
});
