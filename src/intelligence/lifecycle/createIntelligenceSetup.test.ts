import { describe, expect, it } from 'vitest';
import { makeSymbolAnalysis } from '../../setups/testUtils/analysisFixtures';
import { createIntelligenceSetup, priceInZone } from './createIntelligenceSetup';
import { makeValidThesis, makeValidTradePlan } from './testUtils/lifecycleFixtures';

describe('priceInZone', () => {
  it('is true at the exact edges and inside, false outside', () => {
    expect(priceInZone(100, { low: 99, high: 101 })).toBe(true);
    expect(priceInZone(99, { low: 99, high: 101 })).toBe(true);
    expect(priceInZone(101, { low: 99, high: 101 })).toBe(true);
    expect(priceInZone(98.9, { low: 99, high: 101 })).toBe(false);
    expect(priceInZone(101.1, { low: 99, high: 101 })).toBe(false);
  });
});

describe('createIntelligenceSetup', () => {
  it('creates an ACTIVE setup with a full entry snapshot when price is already inside the entry zone', () => {
    const thesis = makeValidThesis('LONG');
    const plan = makeValidTradePlan('LONG');
    const setup = createIntelligenceSetup('SOLUSDT', thesis, plan, { price: 100, now: 1000, origin: 'live', analysis: makeSymbolAnalysis({ symbol: 'SOLUSDT' }), btcAnalysis: null });

    expect(setup.status).toBe('active');
    expect(setup.direction).toBe('LONG');
    expect(setup.family).toBe('evidence_based_thesis');
    expect(setup.entry).not.toBeNull();
    expect(setup.entry?.triggerPrice).toBe(100);
    expect(setup.entry?.firstLivePrice).toBe(100);
    expect(setup.trigger).toEqual(plan.trigger);
    expect(setup.invalidation).toEqual(plan.invalidation);
    expect(setup.targets).toEqual(plan.targets);
    expect(setup.signalStrength).toBe(thesis.signalStrength);
    expect(setup.risk).toBe(plan.risk);
    expect(setup.lifecycle.some((e) => e.type === 'setup_activated')).toBe(true);
  });

  it('creates a WAITING_FOR_CONFIRMATION setup with no entry snapshot when price is outside the entry zone', () => {
    const thesis = makeValidThesis('LONG');
    const plan = makeValidTradePlan('LONG');
    const setup = createIntelligenceSetup('SOLUSDT', thesis, plan, { price: 103, now: 1000, origin: 'live', analysis: makeSymbolAnalysis({ symbol: 'SOLUSDT' }), btcAnalysis: null });

    expect(setup.status).toBe('waiting_for_confirmation');
    expect(setup.entry).toBeNull();
    expect(setup.lifecycle.some((e) => e.type === 'trigger_approached')).toBe(true);
    expect(setup.lifecycle.some((e) => e.type === 'setup_activated')).toBe(false);
  });

  it('never produces the candidate status — only active or waiting_for_confirmation', () => {
    const thesis = makeValidThesis('SHORT');
    const plan = makeValidTradePlan('SHORT');
    const setup = createIntelligenceSetup('SOLUSDT', thesis, plan, { price: 100, now: 1000, origin: 'live', analysis: makeSymbolAnalysis({ symbol: 'SOLUSDT' }), btcAnalysis: null });
    expect(['active', 'waiting_for_confirmation']).toContain(setup.status);
  });

  it('flattens every evidence category into supporting/opposing/missingData with a traceable label', () => {
    const thesis = makeValidThesis('LONG');
    const plan = makeValidTradePlan('LONG');
    const setup = createIntelligenceSetup('SOLUSDT', thesis, plan, { price: 100, now: 1000, origin: 'live', analysis: makeSymbolAnalysis({ symbol: 'SOLUSDT' }), btcAnalysis: null });
    expect(setup.supporting.some((e) => e.detail.includes('Test regime reasoning'))).toBe(true);
  });

  it('carries the origin through unchanged', () => {
    const thesis = makeValidThesis('LONG');
    const plan = makeValidTradePlan('LONG');
    const setup = createIntelligenceSetup('SOLUSDT', thesis, plan, { price: 100, now: 1000, origin: 'simulation', analysis: makeSymbolAnalysis({ symbol: 'SOLUSDT' }), btcAnalysis: null });
    expect(setup.origin).toBe('simulation');
  });
});
