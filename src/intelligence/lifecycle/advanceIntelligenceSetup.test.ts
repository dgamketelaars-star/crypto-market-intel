import { describe, expect, it } from 'vitest';
import { makeSymbolAnalysis } from '../../setups/testUtils/analysisFixtures';
import { advanceIntelligenceSetup, invalidateVanishedIntelligenceSetup } from './advanceIntelligenceSetup';
import { createIntelligenceSetup } from './createIntelligenceSetup';
import { makeValidThesis, makeValidTradePlan } from './testUtils/lifecycleFixtures';

function waitingSetup() {
  const thesis = makeValidThesis('LONG');
  const plan = makeValidTradePlan('LONG');
  return createIntelligenceSetup('SOLUSDT', thesis, plan, { price: 103, now: 1000, origin: 'live', analysis: makeSymbolAnalysis({ symbol: 'SOLUSDT' }), btcAnalysis: null });
}

describe('advanceIntelligenceSetup', () => {
  it('activates a waiting setup once price enters the entry zone, freezing the plan and recording an entry snapshot', () => {
    const setup = waitingSetup();
    const thesis = makeValidThesis('LONG');
    const plan = makeValidTradePlan('LONG');
    const advanced = advanceIntelligenceSetup(setup, thesis, plan, { price: 100, now: 2000, analysis: makeSymbolAnalysis({ symbol: 'SOLUSDT' }), btcAnalysis: null });

    expect(advanced.status).toBe('active');
    expect(advanced.entry).not.toBeNull();
    expect(advanced.entry?.triggerPrice).toBe(100);
    expect(advanced.lifecycle.some((e) => e.type === 'setup_activated')).toBe(true);
  });

  it('keeps updating trigger/invalidation/targets while still forming', () => {
    const setup = waitingSetup();
    const thesis = makeValidThesis('LONG');
    const movedPlan = makeValidTradePlan('LONG', { trigger: { price: 102, timeframe: '1h', method: 'support-resistance-zone', explanation: 'Moved zone.' }, entryZone: { low: 101, high: 103 } });
    const advanced = advanceIntelligenceSetup(setup, thesis, movedPlan, { price: 104, now: 2000, analysis: makeSymbolAnalysis({ symbol: 'SOLUSDT' }), btcAnalysis: null });

    expect(advanced.status).toBe('waiting_for_confirmation');
    expect(advanced.trigger.price).toBe(102);
    expect(advanced.changeLog.entryZone).toBe(2000);
  });

  it('freezes the plan and stops tracking changes once active', () => {
    const setup = waitingSetup();
    const thesis = makeValidThesis('LONG');
    const plan = makeValidTradePlan('LONG');
    const active = advanceIntelligenceSetup(setup, thesis, plan, { price: 100, now: 2000, analysis: makeSymbolAnalysis({ symbol: 'SOLUSDT' }), btcAnalysis: null });

    const movedPlan = makeValidTradePlan('LONG', { trigger: { price: 150, timeframe: '1h', method: 'support-resistance-zone', explanation: 'Should be ignored.' } });
    const stillActive = advanceIntelligenceSetup(active, thesis, movedPlan, { price: 105, now: 3000, analysis: makeSymbolAnalysis({ symbol: 'SOLUSDT' }), btcAnalysis: null });
    // advanceIntelligenceSetup is only ever called for non-active setups by the orchestrator, but even if
    // called again, an already-active setup's frozen levels must never be overwritten by a fresh plan.
    expect(stillActive.trigger.price).toBe(100);
  });

  it('emits a strength_changed event when signal strength differs from the stored setup', () => {
    const setup = waitingSetup();
    const strongerThesis = makeValidThesis('LONG', { signalStrength: 'Very high' });
    const plan = makeValidTradePlan('LONG');
    const advanced = advanceIntelligenceSetup(setup, strongerThesis, plan, { price: 103, now: 2000, analysis: makeSymbolAnalysis({ symbol: 'SOLUSDT' }), btcAnalysis: null });
    expect(advanced.signalStrength).toBe('Very high');
    expect(advanced.lifecycle.some((e) => e.type === 'strength_changed')).toBe(true);
  });
});

describe('invalidateVanishedIntelligenceSetup', () => {
  it('closes the setup as invalidated when the underlying thesis no longer holds', () => {
    const setup = waitingSetup();
    const result = invalidateVanishedIntelligenceSetup(setup, 2000);
    expect(result.status).toBe('invalidated');
    expect(result.closedPrice).toBeNull(); // never activated, so no exit price
  });
});
