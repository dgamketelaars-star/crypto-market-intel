import { describe, expect, it } from 'vitest';
import { makeStructure, makeTrend, makeVolatility } from '../../setups/testUtils/analysisFixtures';
import type { AdxPoint } from '../../analysis/indicators/adx';
import { classifyMarketRegime, type ClassifyRegimeInput } from './classifyRegime';

function adx(value: number): AdxPoint {
  return { adx: value, plusDi: value > 15 ? 30 : 15, minusDi: value > 15 ? 15 : 30 };
}

function baseInput(overrides: Partial<ClassifyRegimeInput> = {}): ClassifyRegimeInput {
  return {
    trend4h: makeTrend({}, '4h'),
    trend1d: makeTrend({}, '1d'),
    volatility4h: makeVolatility({}, '4h'),
    volatility1d: makeVolatility({}, '1d'),
    structure4h: makeStructure({}, '4h'),
    structure1d: makeStructure({}, '1d'),
    adx4h: adx(30),
    adx1d: adx(30),
    ...overrides,
  };
}

describe('classifyMarketRegime', () => {
  it('returns insufficient_data when neither 1D nor 4H trend has enough history', () => {
    const result = classifyMarketRegime(
      baseInput({
        trend1d: makeTrend({ sufficientData: false, classification: 'insufficient_data' }, '1d'),
        trend4h: makeTrend({ sufficientData: false, classification: 'insufficient_data' }, '4h'),
      }),
    );
    expect(result.regime).toBe('insufficient_data');
    expect(result.bias).toBe('neutral');
  });

  it('classifies strong_uptrend with bullish bias when ADX confirms trend strength', () => {
    const result = classifyMarketRegime(
      baseInput({
        trend1d: makeTrend({ classification: 'uptrend', emaAlignment: 'bullish' }, '1d'),
        adx1d: adx(35),
      }),
    );
    expect(result.regime).toBe('strong_uptrend');
    expect(result.bias).toBe('bullish');
  });

  it('classifies weak_uptrend when trend is up but ADX is below the strength threshold', () => {
    const result = classifyMarketRegime(
      baseInput({
        trend1d: makeTrend({ classification: 'uptrend', emaAlignment: 'bullish' }, '1d'),
        adx1d: adx(12),
      }),
    );
    expect(result.regime).toBe('weak_uptrend');
    expect(result.bias).toBe('bullish');
  });

  it('classifies strong_downtrend with bearish bias', () => {
    const result = classifyMarketRegime(
      baseInput({
        trend1d: makeTrend({ classification: 'downtrend', emaAlignment: 'bearish' }, '1d'),
        adx1d: adx(30),
      }),
    );
    expect(result.regime).toBe('strong_downtrend');
    expect(result.bias).toBe('bearish');
  });

  it('classifies range with neutral bias for a sideways primary trend', () => {
    const result = classifyMarketRegime(baseInput({ trend1d: makeTrend({ classification: 'sideways' }, '1d') }));
    expect(result.regime).toBe('range');
    expect(result.bias).toBe('neutral');
  });

  it('classifies compression when the structure signals range compression', () => {
    const result = classifyMarketRegime(
      baseInput({
        trend1d: makeTrend({ classification: 'sideways' }, '1d'),
        structure1d: makeStructure({ rangeCompression: true }, '1d'),
      }),
    );
    expect(result.regime).toBe('compression');
  });

  it('classifies expansion when compression has just released', () => {
    const result = classifyMarketRegime(
      baseInput({
        trend1d: makeTrend({ classification: 'sideways' }, '1d'),
        structure1d: makeStructure({ signal: 'expansion_after_compression' }, '1d'),
      }),
    );
    expect(result.regime).toBe('expansion');
  });

  it('classifies chaotic when 1D and 4H trend directly conflict under extreme volatility', () => {
    const result = classifyMarketRegime(
      baseInput({
        trend1d: makeTrend({ classification: 'uptrend', emaAlignment: 'bullish' }, '1d'),
        trend4h: makeTrend({ classification: 'downtrend', emaAlignment: 'bearish' }, '4h'),
        volatility1d: makeVolatility({ classification: 'extreme' }, '1d'),
      }),
    );
    expect(result.regime).toBe('chaotic');
    expect(result.bias).toBe('neutral');
  });

  it('does not classify chaotic merely from conflicting trends without extreme volatility', () => {
    const result = classifyMarketRegime(
      baseInput({
        trend1d: makeTrend({ classification: 'uptrend', emaAlignment: 'bullish' }, '1d'),
        trend4h: makeTrend({ classification: 'downtrend', emaAlignment: 'bearish' }, '4h'),
        volatility1d: makeVolatility({ classification: 'normal' }, '1d'),
      }),
    );
    expect(result.regime).not.toBe('chaotic');
  });

  it('classifies transition for a mid-transition primary trend', () => {
    const result = classifyMarketRegime(baseInput({ trend1d: makeTrend({ classification: 'transition' }, '1d') }));
    expect(result.regime).toBe('transition');
    expect(result.bias).toBe('neutral');
  });

  it('falls back to 4H when 1D trend is insufficient', () => {
    const result = classifyMarketRegime(
      baseInput({
        trend1d: makeTrend({ sufficientData: false, classification: 'insufficient_data' }, '1d'),
        trend4h: makeTrend({ classification: 'uptrend', emaAlignment: 'bullish' }, '4h'),
        adx4h: adx(30),
      }),
    );
    expect(result.regime).toBe('strong_uptrend');
  });
});
