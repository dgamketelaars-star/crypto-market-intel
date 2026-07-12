import { describe, expect, it } from 'vitest';
import { calculateRisk, type RiskScoringInput } from './risk';

const RISK_ORDER = ['Low', 'Medium', 'High', 'Very high'];

function baseInput(overrides: Partial<RiskScoringInput> = {}): RiskScoringInput {
  return {
    direction: 'LONG',
    volatility: 'normal',
    quoteVolumeRank: 2,
    universeSize: 20,
    fundingState: 'neutral',
    timeframeConflict: false,
    nearOpposingZoneAtrRatio: 5,
    rewardToRisk: 2,
    btcContextAdverse: false,
    missingDataCount: 0,
    ...overrides,
  };
}

describe('calculateRisk', () => {
  it('is Low for a clean, liquid, well-funded setup', () => {
    expect(calculateRisk(baseInput())).toBe('Low');
  });

  it('escalates when volatility, liquidity and funding risk factors stack together', () => {
    const risk = calculateRisk(
      baseInput({ volatility: 'extreme', quoteVolumeRank: 19, universeSize: 20, fundingState: 'very_elevated' }),
    );
    expect(RISK_ORDER.indexOf(risk)).toBeGreaterThan(RISK_ORDER.indexOf('Low'));
  });

  it('penalizes very_elevated funding for a LONG but not for a SHORT', () => {
    const longRisk = calculateRisk(baseInput({ direction: 'LONG', fundingState: 'very_elevated', volatility: 'elevated' }));
    const shortRisk = calculateRisk(baseInput({ direction: 'SHORT', fundingState: 'very_elevated', volatility: 'elevated' }));
    expect(RISK_ORDER.indexOf(longRisk)).toBeGreaterThan(RISK_ORDER.indexOf(shortRisk));
  });

  it('penalizes very_low funding for a SHORT but not for a LONG', () => {
    const longRisk = calculateRisk(baseInput({ direction: 'LONG', fundingState: 'very_low', volatility: 'elevated' }));
    const shortRisk = calculateRisk(baseInput({ direction: 'SHORT', fundingState: 'very_low', volatility: 'elevated' }));
    expect(RISK_ORDER.indexOf(shortRisk)).toBeGreaterThan(RISK_ORDER.indexOf(longRisk));
  });

  it('stacks every risk factor into Very high', () => {
    const risk = calculateRisk(
      baseInput({
        volatility: 'extreme',
        quoteVolumeRank: 20,
        universeSize: 20,
        fundingState: 'very_elevated',
        timeframeConflict: true,
        nearOpposingZoneAtrRatio: 0.5,
        rewardToRisk: 1,
        btcContextAdverse: true,
        missingDataCount: 2,
      }),
    );
    expect(risk).toBe('Very high');
  });

  it('caps the missingDataCount contribution instead of growing unbounded', () => {
    const cappedRisk = calculateRisk(baseInput({ missingDataCount: 2 }));
    const hugeRisk = calculateRisk(baseInput({ missingDataCount: 50 }));
    expect(hugeRisk).toBe(cappedRisk);
  });
});
