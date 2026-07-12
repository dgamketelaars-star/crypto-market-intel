import { describe, expect, it } from 'vitest';
import { evaluateSetupQuality } from './qualityGate';
import { makeFamilyResult, makeLevel, makeTargetCandidate } from '../testUtils/setupFixtures';
import { makeSymbolAnalysis, makeTimeframe, makeTrend, makeVolatility } from '../testUtils/analysisFixtures';

/** Day-trade-scaled analysis: 1H ATR=2, 4H ATR=8, sideways 4H/1D trend (neutral — conflicts with neither LONG nor SHORT) — the default shape used across most tests here. */
function dayScaleAnalysis(overrides: Parameters<typeof makeSymbolAnalysis>[0] = {}) {
  return makeSymbolAnalysis({
    timeframes: {
      '1h': makeTimeframe({ volatility: makeVolatility({ atr14: { value: 2, timeframe: '1h', sufficientData: true, dataTimestamp: 0, calculatedAt: 0 } }, '1h') }, '1h'),
      '4h': makeTimeframe(
        { trend: makeTrend({ classification: 'sideways' }, '4h'), volatility: makeVolatility({ atr14: { value: 8, timeframe: '4h', sufficientData: true, dataTimestamp: 0, calculatedAt: 0 } }, '4h') },
        '4h',
      ),
      '1d': makeTimeframe({ trend: makeTrend({ classification: 'sideways' }, '1d') }, '1d'),
    },
    ...overrides,
  });
}

describe('evaluateSetupQuality — stoploss must be on the correct side', () => {
  it('rejects a LONG whose stoploss sits inside the entry zone', () => {
    const result = makeFamilyResult({
      direction: 'LONG',
      trigger: makeLevel({ price: 105 }),
      entryZone: { low: 100, high: 110 },
      invalidation: makeLevel({ price: 105 }), // inside [100, 110]
      atr: 2,
      targets: [makeTargetCandidate({ price: 115, rewardToRisk: 2 })],
    });
    const check = evaluateSetupQuality(result, dayScaleAnalysis());
    expect(check.valid).toBe(false);
    expect(check.reason).toMatch(/juiste kant/);
  });

  it('rejects a LONG whose stoploss sits above the entry zone', () => {
    const result = makeFamilyResult({
      direction: 'LONG',
      trigger: makeLevel({ price: 105 }),
      entryZone: { low: 100, high: 110 },
      invalidation: makeLevel({ price: 115 }),
      atr: 2,
      targets: [makeTargetCandidate({ price: 120, rewardToRisk: 2 })],
    });
    expect(evaluateSetupQuality(result, dayScaleAnalysis()).valid).toBe(false);
  });

  it('accepts a LONG whose stoploss sits below the entire entry zone', () => {
    const result = makeFamilyResult({
      direction: 'LONG',
      trigger: makeLevel({ price: 100 }),
      entryZone: { low: 100, high: 100 },
      invalidation: makeLevel({ price: 98 }), // 1.0x 1H ATR(2) below trigger
      atr: 2,
      targets: [makeTargetCandidate({ price: 110, rewardToRisk: 2.5 })], // 5x 1H ATR reward -> day trade scale
    });
    expect(evaluateSetupQuality(result, dayScaleAnalysis()).valid).toBe(true);
  });

  it('rejects a SHORT whose stoploss sits inside or below the entry zone', () => {
    const result = makeFamilyResult({
      direction: 'SHORT',
      trigger: makeLevel({ price: 95 }),
      entryZone: { low: 90, high: 100 },
      invalidation: makeLevel({ price: 95 }), // inside the zone
      atr: 2,
      targets: [makeTargetCandidate({ price: 80, rewardToRisk: 2 })],
    });
    expect(evaluateSetupQuality(result, dayScaleAnalysis()).valid).toBe(false);
  });

  it('accepts a SHORT whose stoploss sits above the entire entry zone', () => {
    const result = makeFamilyResult({
      direction: 'SHORT',
      trigger: makeLevel({ price: 100 }),
      entryZone: { low: 100, high: 100 },
      invalidation: makeLevel({ price: 102 }), // 1.0x 1H ATR(2) above trigger
      atr: 2,
      targets: [makeTargetCandidate({ price: 90, rewardToRisk: 2.5 })], // 5x 1H ATR reward
    });
    expect(evaluateSetupQuality(result, dayScaleAnalysis()).valid).toBe(true);
  });

  it('falls back to the trigger price when there is no entry zone', () => {
    const invalidLong = makeFamilyResult({
      direction: 'LONG',
      entryZone: null,
      trigger: makeLevel({ price: 100 }),
      invalidation: makeLevel({ price: 105 }), // above trigger for a LONG
      atr: 2,
      targets: [makeTargetCandidate({ price: 120, rewardToRisk: 2 })],
    });
    expect(evaluateSetupQuality(invalidLong, dayScaleAnalysis()).valid).toBe(false);
  });
});

describe('evaluateSetupQuality — day-trade stop must clear the 1H ATR floor (0.8x)', () => {
  it('rejects a stop only a few ticks from the trigger', () => {
    const result = makeFamilyResult({
      direction: 'LONG',
      trigger: makeLevel({ price: 100 }),
      entryZone: { low: 100, high: 100 },
      invalidation: makeLevel({ price: 99.95 }), // 0.05 away, 1H atr=2 -> way below 0.8*2=1.6
      atr: 2,
      targets: [makeTargetCandidate({ price: 110, rewardToRisk: 2 })],
    });
    const check = evaluateSetupQuality(result, dayScaleAnalysis());
    expect(check.valid).toBe(false);
    expect(check.reason).toMatch(/te dicht op de trigger/);
  });

  it('accepts a stop that clears the horizon-appropriate ATR floor', () => {
    const result = makeFamilyResult({
      direction: 'LONG',
      trigger: makeLevel({ price: 100 }),
      entryZone: { low: 100, high: 100 },
      invalidation: makeLevel({ price: 98 }), // 1.0x 1H ATR(2), clears 0.8x floor
      atr: 2,
      targets: [makeTargetCandidate({ price: 110, rewardToRisk: 2.5 })],
    });
    expect(evaluateSetupQuality(result, dayScaleAnalysis()).valid).toBe(true);
  });

  it('rejects when ATR is zero or negative (no basis for a structural stop at all)', () => {
    const result = makeFamilyResult({ direction: 'LONG', trigger: makeLevel({ price: 100 }), invalidation: makeLevel({ price: 90 }), atr: 0 });
    expect(evaluateSetupQuality(result, dayScaleAnalysis()).valid).toBe(false);
  });

  it('rejects a stop built only from the old (now too permissive) 0.5x ATR buffer', () => {
    // Mirrors how families build invalidation today (trigger +/- 0.5x ATR) — this must now fail the stricter 0.8x floor.
    const atr = 2;
    const result = makeFamilyResult({
      direction: 'LONG',
      trigger: makeLevel({ price: 100 }),
      entryZone: { low: 100, high: 100 },
      invalidation: makeLevel({ price: 100 - 0.5 * atr }),
      atr,
      targets: [makeTargetCandidate({ price: 110, rewardToRisk: 2 })],
    });
    expect(evaluateSetupQuality(result, dayScaleAnalysis()).valid).toBe(false);
  });
});

describe('evaluateSetupQuality — swing-trade stop must clear the 4H ATR floor (0.8x)', () => {
  function swingResult(invalidationPrice: number) {
    return makeFamilyResult({
      direction: 'LONG',
      trigger: makeLevel({ price: 100 }),
      entryZone: { low: 100, high: 100 },
      invalidation: makeLevel({ price: invalidationPrice }),
      atr: 1, // 1H ATR small so reward/1H-ATR clears the day-trade ceiling easily
      targets: [makeTargetCandidate({ price: 150, rewardToRisk: 5 })], // 50x 1H ATR, 6.25x 4H ATR(8) -> swing scale
    });
  }

  it('rejects a swing stop that only clears 1H-noise distance, not the 4H floor', () => {
    // 0.8x 4H ATR(8) = 6.4 required; this stop is only 1H-scaled (2 away).
    const check = evaluateSetupQuality(swingResult(98), dayScaleAnalysis());
    expect(check.valid).toBe(false);
    expect(check.reason).toMatch(/swing trade/);
  });

  it('accepts a swing stop that clears the 4H ATR floor', () => {
    // 0.8x 4H ATR(8) = 6.4 required; 7 away clears it.
    expect(evaluateSetupQuality(swingResult(93), dayScaleAnalysis()).valid).toBe(true);
  });

  it('rejects a swing-scaled setup when there is no 4H ATR data to validate the stop against', () => {
    const noAtr4h = makeSymbolAnalysis({
      timeframes: {
        '1h': makeTimeframe({ volatility: makeVolatility({ atr14: { value: 1, timeframe: '1h', sufficientData: true, dataTimestamp: 0, calculatedAt: 0 } }, '1h') }, '1h'),
        '4h': makeTimeframe({ volatility: makeVolatility({ sufficientData: false }, '4h') }, '4h'),
        '1d': makeTimeframe({}, '1d'),
      },
    });
    expect(evaluateSetupQuality(swingResult(93), noAtr4h).valid).toBe(false);
  });
});

describe('evaluateSetupQuality — targets too close for the horizon are rejected', () => {
  it('rejects a day-trade target closer than 1.0x 1H ATR (scalp-scale)', () => {
    const result = makeFamilyResult({
      direction: 'LONG',
      trigger: makeLevel({ price: 100 }),
      entryZone: { low: 100, high: 100 },
      invalidation: makeLevel({ price: 98 }),
      atr: 2,
      targets: [makeTargetCandidate({ price: 100.5, rewardToRisk: 2 })], // 0.25x 1H ATR — scalp-tier
    });
    expect(evaluateSetupQuality(result, dayScaleAnalysis()).valid).toBe(false);
  });

  it('drops a swing target closer than 1.0x 4H ATR while a further one still classifies and survives', () => {
    const result = makeFamilyResult({
      direction: 'LONG',
      trigger: makeLevel({ price: 100 }),
      entryZone: { low: 100, high: 100 },
      invalidation: makeLevel({ price: 93 }), // clears the 4H stop floor (0.8*8=6.4)
      atr: 1, // 1H ATR tiny so both targets clear the day-trade ceiling
      targets: [
        makeTargetCandidate({ price: 104, rewardToRisk: 2 }), // 4x 1H ATR, 0.5x 4H ATR(8) -> too close for swing, filtered
        makeTargetCandidate({ price: 150, rewardToRisk: 50 / 7 }), // 50x 1H ATR, 6.25x 4H ATR -> classifies + survives
      ],
    });
    const check = evaluateSetupQuality(result, dayScaleAnalysis());
    expect(check.valid).toBe(true);
    expect(check.horizon).toBe('SWING_TRADE');
    expect(check.targets).toHaveLength(1);
    expect(check.targets[0].price).toBe(150);
  });

  it('drops only the too-close target when a further one still survives, keeping the setup valid', () => {
    const result = makeFamilyResult({
      direction: 'LONG',
      trigger: makeLevel({ price: 100 }),
      entryZone: { low: 100, high: 100 },
      invalidation: makeLevel({ price: 98 }),
      atr: 2,
      targets: [
        makeTargetCandidate({ price: 100.5, rewardToRisk: 2 }), // 0.25x 1H ATR -> filtered out
        makeTargetCandidate({ price: 110, rewardToRisk: 2.5 }), // 5x 1H ATR -> survives
      ],
    });
    const check = evaluateSetupQuality(result, dayScaleAnalysis());
    expect(check.valid).toBe(true);
    expect(check.targets).toHaveLength(1);
    expect(check.targets[0].price).toBe(110);
  });
});

describe('evaluateSetupQuality — degenerate R:R from a disproportionately tiny stop', () => {
  it('rejects a target whose R:R is only high because the stop barely clears the floor', () => {
    const result = makeFamilyResult({
      direction: 'LONG',
      trigger: makeLevel({ price: 100 }),
      entryZone: { low: 100, high: 100 },
      invalidation: makeLevel({ price: 92 }), // 8 away: 1x 4H ATR(8), barely past the 0.8x floor (6.4)
      atr: 1, // 1H atr tiny so reward/1H-atr clears the day ceiling
      targets: [makeTargetCandidate({ price: 300, rewardToRisk: 25 })], // reward 200 -> RR = 200/8 = 25 > reviewCeiling(15)
    });
    const check = evaluateSetupQuality(result, dayScaleAnalysis());
    expect(check.valid).toBe(false);
    expect(check.reason).toMatch(/Geen koersdoel/);
  });

  it('accepts an equally high R:R when the stop is proportionally wide (not just past the floor)', () => {
    const result = makeFamilyResult({
      direction: 'LONG',
      trigger: makeLevel({ price: 100 }),
      entryZone: { low: 100, high: 100 },
      invalidation: makeLevel({ price: 88 }), // 12 away: 1.5x 4H ATR(8) -> clears safeAtrRiskMult, not "barely past the floor"
      atr: 1,
      targets: [makeTargetCandidate({ price: 400, rewardToRisk: 25 })], // reward 300 -> RR = 300/12 = 25, same R:R as above
    });
    expect(evaluateSetupQuality(result, dayScaleAnalysis()).valid).toBe(true);
  });
});

describe('evaluateSetupQuality — targets are mandatory', () => {
  it('rejects a result with no targets (nothing to classify a horizon from)', () => {
    const result = makeFamilyResult({
      direction: 'LONG',
      trigger: makeLevel({ price: 100 }),
      entryZone: { low: 100, high: 100 },
      invalidation: makeLevel({ price: 90 }),
      atr: 2,
      targets: [],
    });
    const check = evaluateSetupQuality(result, dayScaleAnalysis());
    expect(check.valid).toBe(false);
    expect(check.reason).toMatch(/Geen koersdoel/);
  });

  it('accepts a valid day-trade setup end to end', () => {
    const result = makeFamilyResult({
      direction: 'LONG',
      trigger: makeLevel({ price: 100 }),
      entryZone: { low: 99, high: 100 },
      invalidation: makeLevel({ price: 97 }), // 1H ATR(2) * 1.5 = 3 away, clears 0.8x floor
      atr: 2,
      targets: [makeTargetCandidate({ price: 110, rewardToRisk: 10 / 3 })], // 5x 1H ATR reward, day scale
    });
    const check = evaluateSetupQuality(result, dayScaleAnalysis());
    expect(check.valid).toBe(true);
    expect(check.horizon).toBe('DAY_TRADE');
  });

  it('accepts a valid swing-trade setup end to end', () => {
    const result = makeFamilyResult({
      direction: 'LONG',
      trigger: makeLevel({ price: 100 }),
      entryZone: { low: 99, high: 100 },
      invalidation: makeLevel({ price: 93 }), // 7 away: clears 0.8x 4H ATR(8) = 6.4
      atr: 1,
      targets: [makeTargetCandidate({ price: 150, rewardToRisk: 50 / 7 })], // 50x 1H ATR, 6.25x 4H ATR
    });
    const check = evaluateSetupQuality(result, dayScaleAnalysis());
    expect(check.valid).toBe(true);
    expect(check.horizon).toBe('SWING_TRADE');
  });
});

describe('evaluateSetupQuality — no defensible horizon means no setup', () => {
  it('rejects a result whose reward scale fits neither day nor swing', () => {
    const result = makeFamilyResult({
      direction: 'LONG',
      trigger: makeLevel({ price: 100 }),
      entryZone: { low: 100, high: 100 },
      invalidation: makeLevel({ price: 98 }),
      atr: 2,
      targets: [makeTargetCandidate({ price: 100.2, rewardToRisk: 2 })], // 0.1x 1H ATR — below every threshold
    });
    const check = evaluateSetupQuality(result, dayScaleAnalysis());
    expect(check.valid).toBe(false);
    expect(check.horizon).toBeNull();
  });

  it('rejects a day-scaled setup when 4H trend directly opposes the direction', () => {
    const conflictingAnalysis = makeSymbolAnalysis({
      timeframes: {
        '1h': makeTimeframe({ volatility: makeVolatility({ atr14: { value: 2, timeframe: '1h', sufficientData: true, dataTimestamp: 0, calculatedAt: 0 } }, '1h') }, '1h'),
        '4h': makeTimeframe({ trend: makeTrend({ classification: 'downtrend' }, '4h'), volatility: makeVolatility({ atr14: { value: 8, timeframe: '4h', sufficientData: true, dataTimestamp: 0, calculatedAt: 0 } }, '4h') }, '4h'),
        '1d': makeTimeframe({ trend: makeTrend({ classification: 'downtrend' }, '1d') }, '1d'),
      },
    });
    const result = makeFamilyResult({
      direction: 'LONG',
      trigger: makeLevel({ price: 100 }),
      entryZone: { low: 100, high: 100 },
      invalidation: makeLevel({ price: 98 }),
      atr: 2,
      targets: [makeTargetCandidate({ price: 110, rewardToRisk: 2.5 })], // day scale, but 4H (and 1D) trend both oppose LONG
    });
    const check = evaluateSetupQuality(result, conflictingAnalysis);
    expect(check.valid).toBe(false);
    expect(check.horizon).toBeNull();
  });
});
