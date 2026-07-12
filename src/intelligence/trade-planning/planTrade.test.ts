import { describe, expect, it } from 'vitest';
import { zigzagCandles } from '../../analysis/testUtils/fixtures';
import { latestAtr } from '../../analysis/indicators/atr';
import { categoryEvidence } from '../evidence/build';
import { planTrade, type PlanTradeInput } from './planTrade';

// Higher lows (98 -> 104 -> 112) and higher highs (110 -> 122 -> 128): an established up-swing with
// a support pivot near the test's current price and two resistance pivots above it for targets.
const PIVOTS = [116, 98, 110, 104, 122, 112, 128, 118];

function baseInput(overrides: Partial<PlanTradeInput> = {}): PlanTradeInput {
  const candles = zigzagCandles(PIVOTS);
  const atr = latestAtr(candles) ?? 0.1;
  return {
    direction: 'LONG',
    price: 112.3,
    candles1h: candles,
    candles4h: candles,
    atr1h: atr,
    atr4h: atr,
    volatility4h: 'normal',
    derivativesEvidence: categoryEvidence({ category: 'derivatives_positioning', conclusion: 'neutral', timeframe: 'multi', sourceTimestamp: 1 }),
    btcContextEvidence: categoryEvidence({ category: 'btc_eth_context', conclusion: 'bullish', timeframe: 'multi', sourceTimestamp: 1 }),
    quoteVolumeRank: 3,
    universeSize: 20,
    priceVsEma200Pct: 5,
    ...overrides,
  };
}

describe('planTrade', () => {
  it('builds a VALID_PLAN as a DAY_TRADE from the nearest 1H support zone, with structure-sourced targets', () => {
    const result = planTrade(baseInput());
    expect(result.outcome).toBe('VALID_PLAN');
    if (result.outcome === 'VALID_PLAN') {
      expect(result.horizon).toBe('DAY_TRADE');
      expect(result.direction).toBe('LONG');
      expect(result.trigger.price).toBeCloseTo(112, 0);
      expect(result.invalidation.price).toBeLessThan(result.entryZone.low);
      expect(result.targets.length).toBeGreaterThan(0);
      for (const target of result.targets) {
        expect(target.price).toBeGreaterThan(result.trigger.price);
        expect(target.rewardToRisk).not.toBeNull();
        expect(target.rewardToRisk!).toBeGreaterThanOrEqual(1.5);
      }
      // Staged-exit portions must sum to 100.
      const totalPortion = result.targets.reduce((sum, t) => sum + t.positionPortionPct, 0);
      expect(totalPortion).toBe(100);
      expect(result.targets.at(-1)!.isFinal).toBe(true);
    }
  });

  it('never places the invalidation on the wrong side of the entry zone for a LONG', () => {
    const result = planTrade(baseInput());
    if (result.outcome === 'VALID_PLAN') {
      expect(result.invalidation.price).toBeLessThan(result.entryZone.low);
    } else {
      throw new Error(`expected VALID_PLAN, got ${result.outcome}: ${result.reason}`);
    }
  });

  it('builds a symmetric SHORT plan from a resistance zone with targets below', () => {
    const candles = zigzagCandles([98, 122, 104, 110, 98, 112, 90, 100]); // lower highs, lower lows (down-swing)
    const atr = latestAtr(candles) ?? 0.1;
    const result = planTrade(
      baseInput({
        direction: 'SHORT',
        price: 112 - 0.3,
        candles1h: candles,
        candles4h: candles,
        atr1h: atr,
        atr4h: atr,
        btcContextEvidence: categoryEvidence({ category: 'btc_eth_context', conclusion: 'bearish', timeframe: 'multi', sourceTimestamp: 1 }),
      }),
    );
    expect(result.outcome).toBe('VALID_PLAN');
    if (result.outcome === 'VALID_PLAN') {
      expect(result.direction).toBe('SHORT');
      expect(result.invalidation.price).toBeGreaterThan(result.entryZone.high);
      for (const target of result.targets) expect(target.price).toBeLessThan(result.trigger.price);
    }
  });

  it('rejects with entry_missed when price has drifted past the entry zone but is still within the zone-search radius', () => {
    // Still close enough to find the same support zone (within maxZoneDistanceAtrMult), but far
    // enough beyond the entry zone itself (within maxMissedEntryAtrMult) to count as already missed.
    const result = planTrade(baseInput({ price: 114.5 }));
    expect(result.outcome).toBe('NO_PLAN');
    if (result.outcome === 'NO_PLAN') expect(result.reason).toBe('entry_missed');
  });

  it('rejects with no_structural_stack when price is far beyond any zone-search radius', () => {
    const result = planTrade(baseInput({ price: 300 }));
    expect(result.outcome).toBe('NO_PLAN');
    if (result.outcome === 'NO_PLAN') expect(result.reason).toBe('no_structural_stack');
  });

  it('rejects with no_structural_stack when neither timeframe has a defensible zone for the direction', () => {
    const flatCandles = zigzagCandles([100, 101]); // far too little history for any swing pivot
    const result = planTrade(baseInput({ candles1h: flatCandles, candles4h: flatCandles, price: 100.5 }));
    expect(result.outcome).toBe('NO_PLAN');
    if (result.outcome === 'NO_PLAN') expect(result.reason).toBe('no_structural_stack');
  });

  it('falls back to SWING_TRADE when 1H has no defensible zone but 4H does', () => {
    const thin1h = zigzagCandles([100, 101]);
    const result = planTrade(baseInput({ candles1h: thin1h }));
    expect(result.outcome).toBe('VALID_PLAN');
    if (result.outcome === 'VALID_PLAN') expect(result.horizon).toBe('SWING_TRADE');
  });

  it('assigns a Risk level and includes factor explanations', () => {
    const result = planTrade(baseInput());
    if (result.outcome === 'VALID_PLAN') {
      expect(['Low', 'Medium', 'High', 'Very high']).toContain(result.risk);
      expect(Array.isArray(result.riskFactors)).toBe(true);
    } else {
      throw new Error(`expected VALID_PLAN, got ${result.outcome}`);
    }
  });

  it('raises risk when volatility is extreme and derivatives/context oppose the direction', () => {
    const clean = planTrade(baseInput());
    const risky = planTrade(
      baseInput({
        volatility4h: 'extreme',
        derivativesEvidence: categoryEvidence({
          category: 'derivatives_positioning',
          conclusion: 'neutral',
          opposing: [{ description: 'Funding is elevated — longs are crowded.', timeframe: 'multi', sourceTimestamp: 1 }],
          timeframe: 'multi',
          sourceTimestamp: 1,
        }),
        btcContextEvidence: categoryEvidence({ category: 'btc_eth_context', conclusion: 'bearish', timeframe: 'multi', sourceTimestamp: 1 }),
        priceVsEma200Pct: 40,
      }),
    );
    expect(clean.outcome).toBe('VALID_PLAN');
    expect(risky.outcome).toBe('VALID_PLAN');
    if (clean.outcome === 'VALID_PLAN' && risky.outcome === 'VALID_PLAN') {
      const order = ['Low', 'Medium', 'High', 'Very high'];
      expect(order.indexOf(risky.risk)).toBeGreaterThan(order.indexOf(clean.risk));
    }
  });
});
