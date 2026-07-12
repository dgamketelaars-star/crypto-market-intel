import { describe, expect, it } from 'vitest';
import { makeSymbolAnalysis, makeTimeframe, makeTrend, makeVolatility } from '../testUtils/analysisFixtures';
import { makeFamilyResult, makeGeneratedSetup, makeLevel, makeTarget, FIXTURE_NOW } from '../testUtils/setupFixtures';
import { SETUP_RULES } from '../engine/rules';
import {
  advanceOpenSetup,
  calculateEntryDistance,
  checkExpiry,
  createSetup,
  evaluateActiveSetup,
  invalidateVanishedSetup,
  type ActivationContext,
} from './lifecycle';

const ALLOW_ACTIVATION: ActivationContext = { allowActivation: true, directionRejection: null };
const BLOCK_ACTIVATION: ActivationContext = { allowActivation: false, directionRejection: null };

describe('createSetup', () => {
  it('maps candidate readiness to a candidate setup with a candidate_created event', () => {
    const fresh = makeFamilyResult({ readiness: 'candidate' });
    const setup = createSetup('TESTUSDT', fresh, {
      btcAnalysis: null,
      analysis: makeSymbolAnalysis(),
      price: 105,
      now: FIXTURE_NOW,
      origin: 'live',
      activation: ALLOW_ACTIVATION,
      tradeHorizon: 'DAY_TRADE',
    });
    expect(setup.status).toBe('candidate');
    expect(setup.lifecycle.map((e) => e.type)).toEqual(['candidate_created']);
    expect(setup.origin).toBe('live');
  });

  it('maps active_ready readiness straight to active, with confirmation + activation events', () => {
    const fresh = makeFamilyResult({ readiness: 'active_ready' });
    const setup = createSetup('TESTUSDT', fresh, {
      btcAnalysis: null,
      analysis: makeSymbolAnalysis(),
      price: fresh.trigger.price,
      now: FIXTURE_NOW,
      origin: 'live',
      activation: ALLOW_ACTIVATION,
      tradeHorizon: 'DAY_TRADE',
    });
    expect(setup.status).toBe('active');
    expect(setup.lifecycle.map((e) => e.type)).toEqual(['candidate_created', 'confirmation_received', 'setup_activated']);
  });

  it('computes signal strength from distinct supporting evidence groups', () => {
    const fresh = makeFamilyResult({
      supporting: [
        { group: 'trend', label: 'a', detail: '' },
        { group: 'momentum', label: 'b', detail: '' },
        { group: 'volume', label: 'c', detail: '' },
      ],
    });
    const setup = createSetup('TESTUSDT', fresh, {
      btcAnalysis: null,
      analysis: makeSymbolAnalysis(),
      price: 105,
      now: FIXTURE_NOW,
      origin: 'live',
      activation: ALLOW_ACTIVATION,
      tradeHorizon: 'DAY_TRADE',
    });
    expect(setup.signalStrength).toBe('High');
  });

  it('records the rule version and source timestamps', () => {
    const fresh = makeFamilyResult();
    const analysis = makeSymbolAnalysis({ dataTimestamp: 123 });
    const setup = createSetup('TESTUSDT', fresh, {
      btcAnalysis: null,
      analysis,
      price: 105,
      now: FIXTURE_NOW,
      origin: 'live',
      activation: ALLOW_ACTIVATION,
      tradeHorizon: 'DAY_TRADE',
    });
    expect(setup.ruleVersion).toBe(SETUP_RULES.version);
    expect(setup.sourceDataTimestamps.symbol).toBe(123);
  });
});

describe('createSetup — activation gating', () => {
  it('refuses to activate (caps at waiting_for_confirmation) when the conflict resolver did not award this direction', () => {
    const fresh = makeFamilyResult({ readiness: 'active_ready' });
    const setup = createSetup('TESTUSDT', fresh, {
      btcAnalysis: null,
      analysis: makeSymbolAnalysis(),
      price: fresh.trigger.price,
      now: FIXTURE_NOW,
      origin: 'live',
      activation: BLOCK_ACTIVATION,
      tradeHorizon: 'DAY_TRADE',
    });
    expect(setup.status).toBe('waiting_for_confirmation');
    expect(setup.entry).toBeNull();
  });

  it('refuses to activate when no target meets the minimum reward:risk (family produced zero targets)', () => {
    const fresh = makeFamilyResult({ readiness: 'active_ready', targets: [] });
    const setup = createSetup('TESTUSDT', fresh, {
      btcAnalysis: null,
      analysis: makeSymbolAnalysis(),
      price: fresh.trigger.price,
      now: FIXTURE_NOW,
      origin: 'live',
      activation: ALLOW_ACTIVATION,
      tradeHorizon: 'DAY_TRADE',
    });
    expect(setup.status).toBe('waiting_for_confirmation');
    expect(setup.entry).toBeNull();
    expect(setup.targets).toEqual([]);
  });

  it('records an immutable entry snapshot with the correct trigger/first live price at the moment of activation', () => {
    const fresh = makeFamilyResult({ readiness: 'active_ready' });
    const setup = createSetup('TESTUSDT', fresh, {
      btcAnalysis: null,
      analysis: makeSymbolAnalysis(),
      price: fresh.trigger.price,
      now: FIXTURE_NOW,
      origin: 'live',
      activation: ALLOW_ACTIVATION,
      tradeHorizon: 'DAY_TRADE',
    });
    expect(setup.entry).not.toBeNull();
    expect(setup.entry?.activatedAt).toBe(FIXTURE_NOW);
    expect(setup.entry?.triggerPrice).toBe(fresh.trigger.price);
    expect(setup.entry?.firstLivePrice).toBe(fresh.trigger.price);
    expect(setup.entry?.entryMissed).toBe(false);
  });

  it('flags entry as missed when price already ran beyond the ATR-based allowed distance before activation', () => {
    const fresh = makeFamilyResult({ readiness: 'active_ready', atr: 2 });
    const setup = createSetup('TESTUSDT', fresh, {
      btcAnalysis: null,
      analysis: makeSymbolAnalysis(),
      price: fresh.trigger.price + 10, // far beyond atr(2) * maxMissedEntryAtrMult(1.0)
      now: FIXTURE_NOW,
      origin: 'live',
      activation: ALLOW_ACTIVATION,
      tradeHorizon: 'DAY_TRADE',
    });
    expect(setup.status).toBe('active');
    expect(setup.entry?.entryMissed).toBe(true);
  });

  it('assigns staged-exit target portions that sum to exactly 100', () => {
    const fresh = makeFamilyResult({
      readiness: 'active_ready',
      targets: [
        { ...makeLevel({ price: 120 }), rewardToRisk: 1.5 },
        { ...makeLevel({ price: 130 }), rewardToRisk: 2.5 },
        { ...makeLevel({ price: 140 }), rewardToRisk: 3.5 },
      ],
    });
    const setup = createSetup('TESTUSDT', fresh, {
      btcAnalysis: null,
      analysis: makeSymbolAnalysis(),
      price: fresh.trigger.price,
      now: FIXTURE_NOW,
      origin: 'live',
      activation: ALLOW_ACTIVATION,
      tradeHorizon: 'DAY_TRADE',
    });
    const total = setup.targets.reduce((sum, t) => sum + t.positionPortionPct, 0);
    expect(total).toBe(100);
    expect(setup.targets.filter((t) => t.isFinal)).toHaveLength(1);
  });
});

describe('advanceOpenSetup — candidate to active progression', () => {
  it('progresses candidate -> waiting_for_confirmation when readiness improves', () => {
    const setup = makeGeneratedSetup({ status: 'candidate' });
    const fresh = makeFamilyResult({ readiness: 'waiting_for_confirmation' });
    const updated = advanceOpenSetup(setup, fresh, {
      analysis: makeSymbolAnalysis(),
      btcAnalysis: null,
      price: 105,
      now: FIXTURE_NOW + 1,
      activation: ALLOW_ACTIVATION,
      tradeHorizon: 'DAY_TRADE',
    });
    expect(updated.status).toBe('waiting_for_confirmation');
    expect(updated.lifecycle.some((e) => e.type === 'trigger_approached')).toBe(true);
  });

  it('progresses candidate -> active in one step when confirmation is already fully met', () => {
    const setup = makeGeneratedSetup({ status: 'candidate' });
    const fresh = makeFamilyResult({ readiness: 'active_ready' });
    const updated = advanceOpenSetup(setup, fresh, {
      analysis: makeSymbolAnalysis(),
      btcAnalysis: null,
      price: fresh.trigger.price,
      now: FIXTURE_NOW + 1,
      activation: ALLOW_ACTIVATION,
      tradeHorizon: 'DAY_TRADE',
    });
    expect(updated.status).toBe('active');
    expect(updated.lifecycle.some((e) => e.type === 'confirmation_received')).toBe(true);
    expect(updated.lifecycle.some((e) => e.type === 'setup_activated')).toBe(true);
  });

  it('logs a strength_changed event only when strength actually changes', () => {
    const setup = makeGeneratedSetup({ status: 'candidate', signalStrength: 'Low' });
    const fresh = makeFamilyResult({
      readiness: 'candidate',
      supporting: [
        { group: 'trend', label: 'a', detail: '' },
        { group: 'momentum', label: 'b', detail: '' },
        { group: 'volume', label: 'c', detail: '' },
      ],
    });
    const updated = advanceOpenSetup(setup, fresh, {
      analysis: makeSymbolAnalysis(),
      btcAnalysis: null,
      price: 105,
      now: FIXTURE_NOW + 1,
      activation: ALLOW_ACTIVATION,
      tradeHorizon: 'DAY_TRADE',
    });
    expect(updated.signalStrength).toBe('High');
    expect(updated.lifecycle.some((e) => e.type === 'strength_changed')).toBe(true);
  });

  it('caps readiness at waiting_for_confirmation when the context gate demands stronger confirmation, unless volume spikes', () => {
    const setup = makeGeneratedSetup({ status: 'candidate', symbol: 'SOLUSDT', direction: 'LONG' });
    const btcDowntrend = makeSymbolAnalysis({
      symbol: 'BTCUSDT',
      timeframes: {
        '4h': makeTimeframe({ trend: makeTrend({ classification: 'downtrend', emaAlignment: 'bearish' }, '4h') }, '4h'),
        '1h': makeTimeframe({ volatility: makeVolatility({ classification: 'normal' }, '1h') }, '1h'),
      },
    });
    const fresh = makeFamilyResult({ readiness: 'active_ready' });
    const updated = advanceOpenSetup(setup, fresh, {
      analysis: makeSymbolAnalysis({ symbol: 'SOLUSDT', volume: { classification: 'normal', relativeVolume: 1 } }),
      btcAnalysis: btcDowntrend,
      price: fresh.trigger.price,
      now: FIXTURE_NOW + 1,
      activation: ALLOW_ACTIVATION,
      tradeHorizon: 'DAY_TRADE',
    });
    expect(updated.status).not.toBe('active');
    expect(updated.marketContext.applied).toBe(true);
  });

  it('expires a candidate that has been open longer than the maximum window', () => {
    const setup = makeGeneratedSetup({ status: 'candidate', createdAt: FIXTURE_NOW });
    const fresh = makeFamilyResult({ readiness: 'candidate' });
    const now = FIXTURE_NOW + SETUP_RULES.expiry.maxOpenAgeMs + 1;
    const updated = advanceOpenSetup(setup, fresh, {
      analysis: makeSymbolAnalysis(),
      btcAnalysis: null,
      price: 105,
      now,
      activation: ALLOW_ACTIVATION,
      tradeHorizon: 'DAY_TRADE',
    });
    expect(updated.status).toBe('expired');
    expect(updated.closedReason).toBe('expired');
  });
});

describe('advanceOpenSetup — plan change tracking', () => {
  it('does not flag a change for a tiny (ATR-noise-level) price move', () => {
    const setup = makeGeneratedSetup({ status: 'candidate', invalidation: makeLevel({ price: 100 }) });
    const fresh = makeFamilyResult({ readiness: 'candidate', invalidation: makeLevel({ price: 100.05 }) });
    const updated = advanceOpenSetup(setup, fresh, {
      analysis: makeSymbolAnalysis(),
      btcAnalysis: null,
      price: 105,
      now: FIXTURE_NOW + 1,
      activation: ALLOW_ACTIVATION,
      tradeHorizon: 'DAY_TRADE',
    });
    expect(updated.changeLog.invalidation).toBeNull();
  });

  it('flags an invalidation change once it moves beyond the noise tolerance', () => {
    const setup = makeGeneratedSetup({ status: 'candidate', invalidation: makeLevel({ price: 100 }) });
    const fresh = makeFamilyResult({ readiness: 'candidate', invalidation: makeLevel({ price: 101 }) });
    const now = FIXTURE_NOW + 1;
    const updated = advanceOpenSetup(setup, fresh, {
      analysis: makeSymbolAnalysis(),
      btcAnalysis: null,
      price: 105,
      now,
      activation: ALLOW_ACTIVATION,
      tradeHorizon: 'DAY_TRADE',
    });
    expect(updated.changeLog.invalidation).toBe(now);
  });

  it('flags an entry zone change', () => {
    const setup = makeGeneratedSetup({ status: 'candidate', entryZone: null, trigger: makeLevel({ price: 110 }) });
    const fresh = makeFamilyResult({ readiness: 'candidate', entryZone: { low: 100, high: 105 } });
    const now = FIXTURE_NOW + 1;
    const updated = advanceOpenSetup(setup, fresh, {
      analysis: makeSymbolAnalysis(),
      btcAnalysis: null,
      price: 105,
      now,
      activation: ALLOW_ACTIVATION,
      tradeHorizon: 'DAY_TRADE',
    });
    expect(updated.changeLog.entryZone).toBe(now);
  });

  it('flags a targets change when the target count changes', () => {
    const setup = makeGeneratedSetup({ status: 'candidate', targets: [makeTarget({ price: 130 })] });
    const fresh = makeFamilyResult({
      readiness: 'candidate',
      targets: [
        { ...makeLevel({ price: 120 }), rewardToRisk: 1.5 },
        { ...makeLevel({ price: 140 }), rewardToRisk: 2.5 },
      ],
    });
    const now = FIXTURE_NOW + 1;
    const updated = advanceOpenSetup(setup, fresh, {
      analysis: makeSymbolAnalysis(),
      btcAnalysis: null,
      price: 105,
      now,
      activation: ALLOW_ACTIVATION,
      tradeHorizon: 'DAY_TRADE',
    });
    expect(updated.changeLog.targets).toBe(now);
  });

  it('carries forward a previous change timestamp when nothing further changes', () => {
    const setup = makeGeneratedSetup({ status: 'candidate', invalidation: makeLevel({ price: 100 }) });
    const freshChanged = makeFamilyResult({ readiness: 'candidate', invalidation: makeLevel({ price: 101 }) });
    const t1 = FIXTURE_NOW + 1;
    const afterChange = advanceOpenSetup(setup, freshChanged, {
      analysis: makeSymbolAnalysis(),
      btcAnalysis: null,
      price: 105,
      now: t1,
      activation: ALLOW_ACTIVATION,
      tradeHorizon: 'DAY_TRADE',
    });
    expect(afterChange.changeLog.invalidation).toBe(t1);

    const freshUnchanged = makeFamilyResult({ readiness: 'candidate', invalidation: makeLevel({ price: 101 }) });
    const t2 = FIXTURE_NOW + 2;
    const afterNoChange = advanceOpenSetup(afterChange, freshUnchanged, {
      analysis: makeSymbolAnalysis(),
      btcAnalysis: null,
      price: 105,
      now: t2,
      activation: ALLOW_ACTIVATION,
      tradeHorizon: 'DAY_TRADE',
    });
    expect(afterNoChange.changeLog.invalidation).toBe(t1);
  });

  it('resets the change log to all-null the moment a setup activates', () => {
    const setup = makeGeneratedSetup({
      status: 'candidate',
      invalidation: makeLevel({ price: 100 }),
      changeLog: { entryZone: FIXTURE_NOW - 1000, invalidation: FIXTURE_NOW - 500, targets: null },
    });
    const fresh = makeFamilyResult({ readiness: 'active_ready', invalidation: makeLevel({ price: 100 }) });
    const updated = advanceOpenSetup(setup, fresh, {
      analysis: makeSymbolAnalysis(),
      btcAnalysis: null,
      price: fresh.trigger.price,
      now: FIXTURE_NOW + 1,
      activation: ALLOW_ACTIVATION,
      tradeHorizon: 'DAY_TRADE',
    });
    expect(updated.status).toBe('active');
    expect(updated.changeLog).toEqual({ entryZone: null, invalidation: null, targets: null });
  });
});

describe('invalidateVanishedSetup', () => {
  it('invalidates a candidate whose context conditions no longer hold', () => {
    const setup = makeGeneratedSetup({ status: 'waiting_for_confirmation' });
    const updated = invalidateVanishedSetup(setup, FIXTURE_NOW + 1);
    expect(updated.status).toBe('invalidated');
    expect(updated.closedReason).toBe('invalidation');
    expect(updated.lifecycle.some((e) => e.type === 'setup_invalidated')).toBe(true);
  });

  it('expires instead of invalidating when the max age has already passed', () => {
    const setup = makeGeneratedSetup({ status: 'candidate', createdAt: FIXTURE_NOW });
    const now = FIXTURE_NOW + SETUP_RULES.expiry.maxOpenAgeMs + 1;
    const updated = invalidateVanishedSetup(setup, now);
    expect(updated.status).toBe('expired');
  });
});

describe('evaluateActiveSetup — frozen levels', () => {
  it('never rewrites trigger/invalidation/targets while active', () => {
    const setup = makeGeneratedSetup({ status: 'active' });
    const updated = evaluateActiveSetup(setup, 112, null, FIXTURE_NOW + 1);
    expect(updated.trigger).toEqual(setup.trigger);
    expect(updated.invalidation).toEqual(setup.invalidation);
    expect(updated.targets).toEqual(setup.targets);
  });

  it('completes the setup when price reaches a target (LONG)', () => {
    const setup = makeGeneratedSetup({ status: 'active', direction: 'LONG', targets: [makeTarget({ price: 130 })] });
    const updated = evaluateActiveSetup(setup, 131, null, FIXTURE_NOW + 1);
    expect(updated.status).toBe('completed');
    expect(updated.closedReason).toBe('target');
    expect(updated.lifecycle.some((e) => e.type === 'target_reached')).toBe(true);
    expect(updated.lifecycle.some((e) => e.type === 'setup_completed')).toBe(true);
  });

  it('invalidates the setup when price hits the invalidation level (LONG)', () => {
    const setup = makeGeneratedSetup({ status: 'active', direction: 'LONG', invalidation: makeLevel({ price: 95 }) });
    const updated = evaluateActiveSetup(setup, 94, null, FIXTURE_NOW + 1);
    expect(updated.status).toBe('invalidated');
    expect(updated.closedReason).toBe('invalidation');
  });

  it('completes a SHORT setup when price drops to the target', () => {
    const setup = makeGeneratedSetup({
      status: 'active',
      direction: 'SHORT',
      trigger: makeLevel({ price: 100 }),
      invalidation: makeLevel({ price: 110 }),
      targets: [makeTarget({ price: 80 })],
    });
    const updated = evaluateActiveSetup(setup, 79, null, FIXTURE_NOW + 1);
    expect(updated.status).toBe('completed');
  });

  it('stays active when price is between invalidation and target', () => {
    const setup = makeGeneratedSetup({ status: 'active' });
    const updated = evaluateActiveSetup(setup, 112, null, FIXTURE_NOW + 1);
    expect(updated.status).toBe('active');
  });

  it('force-invalidates an active LONG on a strong adverse BTC context change', () => {
    const setup = makeGeneratedSetup({ status: 'active', symbol: 'SOLUSDT', direction: 'LONG' });
    const strongDownBtc = makeSymbolAnalysis({
      symbol: 'BTCUSDT',
      timeframes: {
        '4h': makeTimeframe({ trend: makeTrend({ classification: 'downtrend', emaAlignment: 'bearish' }, '4h') }, '4h'),
        '1h': makeTimeframe({ volatility: makeVolatility({ classification: 'extreme' }, '1h') }, '1h'),
      },
      positioning: { oiTrend: 'falling' },
    });
    const updated = evaluateActiveSetup(setup, 112, strongDownBtc, FIXTURE_NOW + 1);
    expect(updated.status).toBe('invalidated');
  });

  it('marks a non-final target "reached" without closing the setup (staged exit), then closes on the final target', () => {
    const setup = makeGeneratedSetup({
      status: 'active',
      direction: 'LONG',
      targets: [
        makeTarget({ price: 120, order: 1, positionPortionPct: 60, isFinal: false }),
        makeTarget({ price: 140, order: 2, positionPortionPct: 40, isFinal: true }),
      ],
    });
    const afterFirst = evaluateActiveSetup(setup, 121, null, FIXTURE_NOW + 1);
    expect(afterFirst.status).toBe('active');
    expect(afterFirst.targets[0].status).toBe('reached');
    expect(afterFirst.targets[1].status).toBe('pending');

    const afterFinal = evaluateActiveSetup(afterFirst, 141, null, FIXTURE_NOW + 2);
    expect(afterFinal.status).toBe('completed');
    expect(afterFinal.targets[1].status).toBe('completed');
    expect(afterFinal.closedPrice).toBe(141);
  });

  it('records the live price as closedPrice when an active setup is invalidated', () => {
    const setup = makeGeneratedSetup({ status: 'active', direction: 'LONG', invalidation: makeLevel({ price: 95 }) });
    const updated = evaluateActiveSetup(setup, 94, null, FIXTURE_NOW + 1);
    expect(updated.closedPrice).toBe(94);
  });

  it('never records a closedPrice for a candidate/waiting setup that expires or invalidates before ever activating', () => {
    const waiting = makeGeneratedSetup({ status: 'waiting_for_confirmation' });
    const invalidated = invalidateVanishedSetup(waiting, FIXTURE_NOW + 1);
    expect(invalidated.closedPrice).toBeNull();

    const expiredCandidate = makeGeneratedSetup({ status: 'candidate', createdAt: FIXTURE_NOW });
    const expired = checkExpiry(expiredCandidate, FIXTURE_NOW + SETUP_RULES.expiry.maxOpenAgeMs + 1);
    expect(expired?.closedPrice).toBeNull();
  });

  it('leaves the setup completely unchanged when source data is stale (no silent status change)', () => {
    const setup = makeGeneratedSetup({ status: 'active', direction: 'LONG', invalidation: makeLevel({ price: 95 }) });
    const updated = evaluateActiveSetup(setup, 50, null, FIXTURE_NOW + 1, true);
    expect(updated).toBe(setup);
  });

  it('never rewrites the entry snapshot (activatedAt/triggerPrice/firstLivePrice) across live ticks', () => {
    const setup = makeGeneratedSetup({ status: 'active', direction: 'LONG' });
    const originalEntry = setup.entry;
    const tick1 = evaluateActiveSetup(setup, 111, null, FIXTURE_NOW + 1);
    const tick2 = evaluateActiveSetup(tick1, 115, null, FIXTURE_NOW + 2);
    expect(tick2.entry?.activatedAt).toBe(originalEntry?.activatedAt);
    expect(tick2.entry?.triggerPrice).toBe(originalEntry?.triggerPrice);
    expect(tick2.entry?.firstLivePrice).toBe(originalEntry?.firstLivePrice);
  });

  it('tracks highest favourable / largest adverse excursion correctly for a LONG', () => {
    const setup = makeGeneratedSetup({ status: 'active', direction: 'LONG', entry: { ...makeGeneratedSetup().entry!, highestFavorableExcursion: 110, largestAdverseExcursion: 110 } });
    const up = evaluateActiveSetup(setup, 120, null, FIXTURE_NOW + 1);
    expect(up.entry?.highestFavorableExcursion).toBe(120);
    const down = evaluateActiveSetup(up, 105, null, FIXTURE_NOW + 2);
    expect(down.entry?.largestAdverseExcursion).toBe(105);
    expect(down.entry?.highestFavorableExcursion).toBe(120); // best-so-far is never lowered
  });

  it('tracks highest favourable / largest adverse excursion correctly for a SHORT', () => {
    const setup = makeGeneratedSetup({
      status: 'active',
      direction: 'SHORT',
      trigger: makeLevel({ price: 100 }),
      invalidation: makeLevel({ price: 110 }),
      entry: { ...makeGeneratedSetup().entry!, highestFavorableExcursion: 100, largestAdverseExcursion: 100 },
    });
    const down = evaluateActiveSetup(setup, 90, null, FIXTURE_NOW + 1);
    expect(down.entry?.highestFavorableExcursion).toBe(90); // for SHORT, lower price is favourable
    const up = evaluateActiveSetup(down, 105, null, FIXTURE_NOW + 2);
    expect(up.entry?.largestAdverseExcursion).toBe(105); // for SHORT, higher price is adverse
    expect(up.entry?.highestFavorableExcursion).toBe(90);
  });
});

describe('calculateEntryDistance — LONG/SHORT favourable math', () => {
  it('LONG: price above entry is favourable, positive %', () => {
    const d = calculateEntryDistance('LONG', 100, 110);
    expect(d.pct).toBeCloseTo(10);
    expect(d.favorable).toBe(true);
  });

  it('LONG: price below entry is unfavourable, negative %', () => {
    const d = calculateEntryDistance('LONG', 100, 90);
    expect(d.pct).toBeCloseTo(-10);
    expect(d.favorable).toBe(false);
  });

  it('SHORT: price below entry is favourable, shown as a negative %', () => {
    const d = calculateEntryDistance('SHORT', 100, 95.8);
    expect(d.pct).toBeCloseTo(-4.2, 1);
    expect(d.favorable).toBe(true);
  });

  it('SHORT: price above entry is unfavourable, positive %', () => {
    const d = calculateEntryDistance('SHORT', 100, 105);
    expect(d.pct).toBeCloseTo(5);
    expect(d.favorable).toBe(false);
  });
});

describe('checkExpiry', () => {
  it('returns null (no change) when well within the max age window', () => {
    const setup = makeGeneratedSetup({ status: 'candidate', createdAt: FIXTURE_NOW });
    expect(checkExpiry(setup, FIXTURE_NOW + 60_000)).toBeNull();
  });

  it('expires once past the max age window', () => {
    const setup = makeGeneratedSetup({ status: 'candidate', createdAt: FIXTURE_NOW });
    const expired = checkExpiry(setup, FIXTURE_NOW + SETUP_RULES.expiry.maxOpenAgeMs + 1);
    expect(expired?.status).toBe('expired');
  });
});
