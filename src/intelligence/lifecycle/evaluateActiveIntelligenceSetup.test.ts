import { describe, expect, it } from 'vitest';
import { makeSymbolAnalysis } from '../../setups/testUtils/analysisFixtures';
import { createIntelligenceSetup } from './createIntelligenceSetup';
import { evaluateActiveIntelligenceSetup } from './evaluateActiveIntelligenceSetup';
import { makeValidThesis, makeValidTradePlan } from './testUtils/lifecycleFixtures';

function activeLongSetup() {
  const thesis = makeValidThesis('LONG');
  const plan = makeValidTradePlan('LONG'); // entryZone [99,101], invalidation 95, targets 110 (60%) / 120 (40%, final)
  return createIntelligenceSetup('SOLUSDT', thesis, plan, { price: 100, now: 1000, origin: 'live', analysis: makeSymbolAnalysis({ symbol: 'SOLUSDT' }), btcAnalysis: null });
}

describe('evaluateActiveIntelligenceSetup', () => {
  it('leaves the setup untouched on stale data', () => {
    const setup = activeLongSetup();
    const result = evaluateActiveIntelligenceSetup(setup, 200, 2000, true);
    expect(result).toBe(setup);
  });

  it('invalidates when price hits the invalidation level', () => {
    const setup = activeLongSetup();
    const result = evaluateActiveIntelligenceSetup(setup, 95, 2000);
    expect(result.status).toBe('invalidated');
    expect(result.closedReason).toBe('invalidation');
    expect(result.closedPrice).toBe(95);
  });

  it('marks a non-final target reached without closing the setup', () => {
    const setup = activeLongSetup();
    const result = evaluateActiveIntelligenceSetup(setup, 110, 2000);
    expect(result.status).toBe('active');
    expect(result.targets.find((t) => t.order === 1)?.status).toBe('reached');
    expect(result.targets.find((t) => t.order === 2)?.status).toBe('pending');
    expect(result.lifecycle.some((e) => e.type === 'target_reached')).toBe(true);
  });

  it('completes the setup once the final target is reached', () => {
    const setup = activeLongSetup();
    const result = evaluateActiveIntelligenceSetup(setup, 120, 2000);
    expect(result.status).toBe('completed');
    expect(result.closedReason).toBe('target');
    expect(result.closedPrice).toBe(120);
    expect(result.targets.find((t) => t.order === 2)?.status).toBe('completed');
  });

  it('tracks favorable/adverse excursions as price moves', () => {
    const setup = activeLongSetup();
    const afterFavorable = evaluateActiveIntelligenceSetup(setup, 105, 2000);
    expect(afterFavorable.entry?.highestFavorableExcursion).toBe(105);
    const afterAdverse = evaluateActiveIntelligenceSetup(afterFavorable, 97, 3000);
    expect(afterAdverse.entry?.largestAdverseExcursion).toBe(97);
    expect(afterAdverse.entry?.highestFavorableExcursion).toBe(105); // best-so-far is retained, not overwritten by a worse price
  });

  it('does nothing to a setup with no entry snapshot (defensive no-op)', () => {
    const thesis = makeValidThesis('LONG');
    const plan = makeValidTradePlan('LONG');
    const waiting = createIntelligenceSetup('SOLUSDT', thesis, plan, { price: 103, now: 1000, origin: 'live', analysis: makeSymbolAnalysis({ symbol: 'SOLUSDT' }), btcAnalysis: null });
    const result = evaluateActiveIntelligenceSetup(waiting, 100, 2000);
    expect(result).toBe(waiting);
  });
});
