import { describe, expect, it } from 'vitest';
import { classifyTradeHorizon } from './tradeHorizon';
import { makeFamilyResult, makeLevel, makeTargetCandidate } from '../testUtils/setupFixtures';
import { makeSymbolAnalysis, makeTimeframe, makeTrend, makeVolatility } from '../testUtils/analysisFixtures';

function atrVal(value: number, timeframe: '1h' | '4h' | '1d') {
  return makeVolatility({ atr14: { value, timeframe, sufficientData: true, dataTimestamp: 0, calculatedAt: 0 } }, timeframe);
}

function analysisWith(opts: { atr1h: number; atr4h: number | null; trend4h?: string; trend1d?: string }) {
  return makeSymbolAnalysis({
    timeframes: {
      '1h': makeTimeframe({ volatility: atrVal(opts.atr1h, '1h') }, '1h'),
      '4h': makeTimeframe(
        {
          trend: makeTrend({ classification: (opts.trend4h ?? 'sideways') as never }, '4h'),
          volatility: opts.atr4h === null ? makeVolatility({ sufficientData: false }, '4h') : atrVal(opts.atr4h, '4h'),
        },
        '4h',
      ),
      '1d': makeTimeframe({ trend: makeTrend({ classification: (opts.trend1d ?? 'sideways') as never }, '1d') }, '1d'),
    },
  });
}

describe('classifyTradeHorizon — DAY_TRADE', () => {
  it('classifies a result whose reward is a modest multiple of 1H ATR and 4H trend does not conflict', () => {
    const result = makeFamilyResult({
      direction: 'LONG',
      trigger: makeLevel({ price: 100 }),
      targets: [makeTargetCandidate({ price: 110 })], // 5x 1H ATR(2)
      atr: 2,
    });
    const classification = classifyTradeHorizon(result, analysisWith({ atr1h: 2, atr4h: 8 }));
    expect(classification.horizon).toBe('DAY_TRADE');
    expect(classification.rewardInAtr1h).toBeCloseTo(5);
  });

  it('classifies a SHORT the same way when 4H trend is not opposing (downtrend supports SHORT)', () => {
    const result = makeFamilyResult({
      direction: 'SHORT',
      trigger: makeLevel({ price: 100 }),
      targets: [makeTargetCandidate({ price: 90 })], // 5x 1H ATR
      atr: 2,
    });
    const classification = classifyTradeHorizon(result, analysisWith({ atr1h: 2, atr4h: 8, trend4h: 'downtrend' }));
    expect(classification.horizon).toBe('DAY_TRADE');
  });
});

describe('classifyTradeHorizon — SWING_TRADE', () => {
  it('classifies a result whose reward is large in both 1H and 4H ATR terms and 1D trend does not conflict', () => {
    const result = makeFamilyResult({
      direction: 'LONG',
      trigger: makeLevel({ price: 100 }),
      targets: [makeTargetCandidate({ price: 150 })], // 50x 1H ATR(1), 6.25x 4H ATR(8)
      atr: 1,
    });
    const classification = classifyTradeHorizon(result, analysisWith({ atr1h: 1, atr4h: 8 }));
    expect(classification.horizon).toBe('SWING_TRADE');
    expect(classification.rewardInAtr4h).toBeCloseTo(6.25);
  });

  it('classifies a SHORT the same way when 1D trend is not opposing', () => {
    const result = makeFamilyResult({
      direction: 'SHORT',
      trigger: makeLevel({ price: 100 }),
      targets: [makeTargetCandidate({ price: 50 })], // 50x 1H ATR, 6.25x 4H ATR
      atr: 1,
    });
    const classification = classifyTradeHorizon(result, analysisWith({ atr1h: 1, atr4h: 8, trend1d: 'downtrend' }));
    expect(classification.horizon).toBe('SWING_TRADE');
  });
});

describe('classifyTradeHorizon — rejects when neither horizon is defensible', () => {
  it('rejects a reward scale too small for either horizon', () => {
    const result = makeFamilyResult({
      direction: 'LONG',
      trigger: makeLevel({ price: 100 }),
      targets: [makeTargetCandidate({ price: 100.2 })], // 0.1x 1H ATR
      atr: 2,
    });
    const classification = classifyTradeHorizon(result, analysisWith({ atr1h: 2, atr4h: 8 }));
    expect(classification.horizon).toBeNull();
  });

  it('rejects a day-scale reward when 4H trend directly opposes the LONG direction', () => {
    const result = makeFamilyResult({
      direction: 'LONG',
      trigger: makeLevel({ price: 100 }),
      targets: [makeTargetCandidate({ price: 110 })], // 5x 1H ATR — day-scale
      atr: 2,
    });
    const classification = classifyTradeHorizon(result, analysisWith({ atr1h: 2, atr4h: 8, trend4h: 'downtrend', trend1d: 'downtrend' }));
    expect(classification.horizon).toBeNull();
  });

  it('rejects a swing-scale reward when 1D trend directly opposes the LONG direction', () => {
    const result = makeFamilyResult({
      direction: 'LONG',
      trigger: makeLevel({ price: 100 }),
      targets: [makeTargetCandidate({ price: 150 })], // swing-scale
      atr: 1,
    });
    const classification = classifyTradeHorizon(result, analysisWith({ atr1h: 1, atr4h: 8, trend4h: 'downtrend', trend1d: 'downtrend' }));
    expect(classification.horizon).toBeNull();
  });

  it('rejects when there is no 1H ATR data at all', () => {
    const result = makeFamilyResult({ direction: 'LONG', trigger: makeLevel({ price: 100 }), targets: [makeTargetCandidate({ price: 110 })], atr: 0 });
    const classification = classifyTradeHorizon(result, analysisWith({ atr1h: 2, atr4h: 8 }));
    expect(classification.horizon).toBeNull();
  });

  it('rejects when there are no targets to measure a reward scale from', () => {
    const result = makeFamilyResult({ direction: 'LONG', trigger: makeLevel({ price: 100 }), targets: [], atr: 2 });
    const classification = classifyTradeHorizon(result, analysisWith({ atr1h: 2, atr4h: 8 }));
    expect(classification.horizon).toBeNull();
  });
});
