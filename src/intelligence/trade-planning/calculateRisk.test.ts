import { describe, expect, it } from 'vitest';
import { categoryEvidence } from '../evidence/build';
import { calculateRisk, type RiskInput } from './calculateRisk';

function baseInput(overrides: Partial<RiskInput> = {}): RiskInput {
  return {
    direction: 'LONG',
    volatilityClassification: 'normal',
    stopDistance: 5,
    stopFloor: 2,
    invalidationPrice: 143.7, // not near a round number
    derivativesEvidence: categoryEvidence({ category: 'derivatives_positioning', conclusion: 'neutral', timeframe: 'multi', sourceTimestamp: 1 }),
    btcContextEvidence: categoryEvidence({ category: 'btc_eth_context', conclusion: 'bullish', timeframe: 'multi', sourceTimestamp: 1 }),
    quoteVolumeRank: 3,
    universeSize: 20,
    nearestTargetRewardToRisk: 3,
    priceVsEma200Pct: 5,
    ...overrides,
  };
}

describe('calculateRisk', () => {
  it('is Low when every factor is clean', () => {
    const result = calculateRisk(baseInput());
    expect(result.risk).toBe('Low');
    expect(result.factors).toHaveLength(0);
  });

  it('raises risk for extreme volatility more than elevated volatility', () => {
    const elevated = calculateRisk(baseInput({ volatilityClassification: 'elevated' }));
    const extreme = calculateRisk(baseInput({ volatilityClassification: 'extreme' }));
    const order = ['Low', 'Medium', 'High', 'Very high'];
    expect(order.indexOf(extreme.risk)).toBeGreaterThan(order.indexOf(elevated.risk));
  });

  it('flags a stop sitting close to the sanity floor', () => {
    const result = calculateRisk(baseInput({ stopDistance: 2.1, stopFloor: 2 }));
    expect(result.factors.some((f) => f.includes('sanity floor'))).toBe(true);
  });

  it('flags derivatives opposition/crowding as a headwind without changing direction', () => {
    const result = calculateRisk(
      baseInput({
        derivativesEvidence: categoryEvidence({
          category: 'derivatives_positioning',
          conclusion: 'neutral',
          opposing: [{ description: 'Funding is elevated — longs are already crowded.', timeframe: 'multi', sourceTimestamp: 1 }],
          timeframe: 'multi',
          sourceTimestamp: 1,
        }),
      }),
    );
    expect(result.factors.some((f) => f.toLowerCase().includes('crowding'))).toBe(true);
  });

  it('flags when BTC/ETH context does not confirm the direction', () => {
    const result = calculateRisk(baseInput({ btcContextEvidence: categoryEvidence({ category: 'btc_eth_context', conclusion: 'bearish', timeframe: 'multi', sourceTimestamp: 1 }) }));
    expect(result.factors.some((f) => f.includes('BTC/ETH'))).toBe(true);
  });

  it('flags poor liquidity rank within the universe', () => {
    const result = calculateRisk(baseInput({ quoteVolumeRank: 19, universeSize: 20 }));
    expect(result.factors.some((f) => f.toLowerCase().includes('liquidity'))).toBe(true);
  });

  it('flags a thin nearest-target reward:risk', () => {
    const result = calculateRisk(baseInput({ nearestTargetRewardToRisk: 1.6 }));
    expect(result.factors.some((f) => f.toLowerCase().includes('thin'))).toBe(true);
  });

  it('flags an extended move away from the 200-EMA', () => {
    const result = calculateRisk(baseInput({ priceVsEma200Pct: 25 }));
    expect(result.factors.some((f) => f.includes('200-EMA'))).toBe(true);
  });

  it('flags a stop landing near a round number as a proxy stop-hunt risk', () => {
    const result = calculateRisk(baseInput({ invalidationPrice: 100.05 }));
    expect(result.factors.some((f) => f.toLowerCase().includes('round-number'))).toBe(true);
  });

  it('compounds multiple simultaneous factors into a higher risk level than any single factor alone', () => {
    const single = calculateRisk(baseInput({ volatilityClassification: 'elevated' }));
    const compounded = calculateRisk(
      baseInput({
        volatilityClassification: 'elevated',
        btcContextEvidence: categoryEvidence({ category: 'btc_eth_context', conclusion: 'bearish', timeframe: 'multi', sourceTimestamp: 1 }),
        quoteVolumeRank: 19,
        universeSize: 20,
        priceVsEma200Pct: 30,
      }),
    );
    const order = ['Low', 'Medium', 'High', 'Very high'];
    expect(order.indexOf(compounded.risk)).toBeGreaterThan(order.indexOf(single.risk));
  });
});
