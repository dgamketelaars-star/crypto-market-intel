import { describe, expect, it } from 'vitest';
import {
  classifyAttentionLevel,
  classifyFundingState,
  classifyMomentum,
  classifyOpenInterestTrend,
  classifyVolatility,
  classifyVolume,
  type AttentionDeviation,
} from './rules';

describe('classifyVolatility', () => {
  it('is insufficient_data when either input is missing', () => {
    expect(classifyVolatility(null, 1)).toBe('insufficient_data');
    expect(classifyVolatility(1, null)).toBe('insufficient_data');
  });

  it('classifies low/normal/elevated/extreme by ratio to baseline', () => {
    expect(classifyVolatility(1, 1)).toBe('normal');
    expect(classifyVolatility(1.5, 1)).toBe('elevated');
    expect(classifyVolatility(2.5, 1)).toBe('extreme');
    expect(classifyVolatility(0.3, 1)).toBe('low');
  });
});

describe('classifyVolume', () => {
  it('is insufficient_data when relative volume is null', () => {
    expect(classifyVolume(null)).toBe('insufficient_data');
  });

  it('classifies low/normal/elevated/spike by ratio to average', () => {
    expect(classifyVolume(0.3)).toBe('low');
    expect(classifyVolume(1)).toBe('normal');
    expect(classifyVolume(2)).toBe('elevated');
    expect(classifyVolume(4)).toBe('spike');
  });
});

describe('classifyFundingState', () => {
  it('is insufficient_data with no current funding rate', () => {
    expect(classifyFundingState({ fundingRate: null, history: [] })).toBe('insufficient_data');
  });

  it('falls back to fixed thresholds with too little history', () => {
    expect(classifyFundingState({ fundingRate: 0.002, history: [] })).toBe('very_elevated');
    expect(classifyFundingState({ fundingRate: 0, history: [] })).toBe('neutral');
    expect(classifyFundingState({ fundingRate: -0.002, history: [] })).toBe('very_low');
  });

  it('falls back to fixed thresholds when history has zero variance', () => {
    const history = Array.from({ length: 6 }, () => 0.0001);
    expect(classifyFundingState({ fundingRate: 0.0001, history })).toBe('neutral');
  });

  it('uses a z-score against recent history once enough varied samples exist', () => {
    const varied = [0.0001, 0.0002, 0.0001, 0.0003, 0.0001, 0.0002];
    const result = classifyFundingState({ fundingRate: 0.001, history: varied });
    expect(['elevated', 'very_elevated']).toContain(result);
  });
});

describe('classifyOpenInterestTrend', () => {
  it('is insufficient_data without a 4h change value', () => {
    expect(classifyOpenInterestTrend(null)).toBe('insufficient_data');
  });

  it('classifies rising/falling/flat around the threshold', () => {
    expect(classifyOpenInterestTrend(5)).toBe('rising');
    expect(classifyOpenInterestTrend(-5)).toBe('falling');
    expect(classifyOpenInterestTrend(0.1)).toBe('flat');
  });
});

describe('classifyMomentum', () => {
  it('is insufficient_data when RSI or MACD are not sufficient', () => {
    expect(
      classifyMomentum({ rsiDelta: 1, histogramDelta: 1, priceRoc: 1, rsiSufficient: false, macdSufficient: true }),
    ).toBe('insufficient_data');
    expect(
      classifyMomentum({ rsiDelta: 1, histogramDelta: 1, priceRoc: 1, rsiSufficient: true, macdSufficient: false }),
    ).toBe('insufficient_data');
  });

  it('flags diverging when price and RSI disagree meaningfully', () => {
    const result = classifyMomentum({
      rsiDelta: -5,
      histogramDelta: 1,
      priceRoc: 4,
      rsiSufficient: true,
      macdSufficient: true,
    });
    expect(result).toBe('diverging');
  });

  it('flags strengthening when RSI and MACD histogram both increase', () => {
    const result = classifyMomentum({
      rsiDelta: 3,
      histogramDelta: 0.5,
      priceRoc: 0.2,
      rsiSufficient: true,
      macdSufficient: true,
    });
    expect(result).toBe('strengthening');
  });

  it('flags weakening when RSI and MACD histogram both decrease', () => {
    const result = classifyMomentum({
      rsiDelta: -3,
      histogramDelta: -0.5,
      priceRoc: -0.2,
      rsiSufficient: true,
      macdSufficient: true,
    });
    expect(result).toBe('weakening');
  });

  it('is neutral when signals do not agree and no meaningful divergence exists', () => {
    const result = classifyMomentum({
      rsiDelta: 0.1,
      histogramDelta: -0.05,
      priceRoc: 0.05,
      rsiSufficient: true,
      macdSufficient: true,
    });
    expect(result).toBe('neutral');
  });
});

describe('classifyAttentionLevel', () => {
  const dev = (deviates: boolean, group = 'g'): AttentionDeviation => ({ group, deviates, reason: '' });

  it('is insufficient_data when core data is missing, regardless of deviation count', () => {
    expect(classifyAttentionLevel([dev(true), dev(true), dev(true)], false)).toBe('insufficient_data');
  });

  it('is normal with fewer than 2 deviations', () => {
    expect(classifyAttentionLevel([dev(true), dev(false), dev(false)], true)).toBe('normal');
  });

  it('is worth_watching with exactly 2 deviations', () => {
    expect(classifyAttentionLevel([dev(true), dev(true), dev(false)], true)).toBe('worth_watching');
  });

  it('is unusual_activity with 3 or more deviations', () => {
    expect(classifyAttentionLevel([dev(true), dev(true), dev(true), dev(false)], true)).toBe('unusual_activity');
  });

  it('is normal when there are no deviation groups at all (price direction alone never counts)', () => {
    expect(classifyAttentionLevel([], true)).toBe('normal');
  });
});
