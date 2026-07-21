import { describe, expect, it } from 'vitest';
import { SYSTEM_E_PHASE1_SYSTEM_PROMPT, buildPhase1UserContent } from './phase1Prompt';
import { SYSTEM_E_PHASE2_SYSTEM_PROMPT, buildPhase2UserContent } from './phase2Prompt';
import type { SystemEPhase1Result } from './phase1Schema';
import type { RawMarketSnapshot } from './marketData';

/**
 * "Golden content" tests for Deel 5's anti-perfectionism instructions and
 * Deel 4's anchoring-prevention split. These don't prove the model will
 * actually behave this way, but they guard against a future edit silently
 * weakening or deleting the hard-won behavioral instructions — the prompt
 * text is the only place these rules live.
 */
describe('SYSTEM_E_PHASE1_SYSTEM_PROMPT', () => {
  it('states the expected-value framing instead of a near-certainty bar', () => {
    expect(SYSTEM_E_PHASE1_SYSTEM_PROMPT).toContain('redelijke positieve verwachte waarde');
  });

  it('documents the full A+/A/B/C/D setup-quality rubric and that B is tradeable', () => {
    for (const grade of ['A+', 'A', 'B', 'C', 'D']) {
      expect(SYSTEM_E_PHASE1_SYSTEM_PROMPT).toContain(grade);
    }
    expect(SYSTEM_E_PHASE1_SYSTEM_PROMPT).toMatch(/B[- ]setup is een normaal, legitiem/);
  });

  it('requires the five mandatory counter-questions before WAIT/NO_TRADE', () => {
    expect(SYSTEM_E_PHASE1_SYSTEM_PROMPT).toContain('Verplichte tegenvraag');
    expect(SYSTEM_E_PHASE1_SYSTEM_PROMPT).toContain('imperfecte maar valide B-setup');
    expect(SYSTEM_E_PHASE1_SYSTEM_PROMPT).toContain('rationele daytrader');
  });

  it('requires concrete confirmation conditions for WAIT, and rejects NO_TRADE as a default', () => {
    expect(SYSTEM_E_PHASE1_SYSTEM_PROMPT).toContain('waitConditions');
    expect(SYSTEM_E_PHASE1_SYSTEM_PROMPT).toContain('niet toegestaan');
    expect(SYSTEM_E_PHASE1_SYSTEM_PROMPT).toMatch(/NO_TRADE.*NIET.*standaarduitkomst|standaarduitkomst.*NO_TRADE/i);
  });

  it('is not shown any System A-D content in its user prompt (anchoring prevention)', () => {
    const market: RawMarketSnapshot = {
      symbol: 'BTCUSDT',
      price: 100,
      candles1h: [],
      candles4h: [],
      fundingRatePct: null,
      openInterestValue: null,
      longShortRatio: null,
      recentLiquidationCount: 0,
    };
    const content = buildPhase1UserContent(market);
    expect(content).not.toMatch(/Systeem [ABCD]/);
  });
});

describe('SYSTEM_E_PHASE2_SYSTEM_PROMPT', () => {
  it('forbids vote-counting, averaging, and majority-following', () => {
    expect(SYSTEM_E_PHASE2_SYSTEM_PROMPT).toContain('stemmen te tellen');
    expect(SYSTEM_E_PHASE2_SYSTEM_PROMPT).toContain('richtingen te middelen');
    expect(SYSTEM_E_PHASE2_SYSTEM_PROMPT).toContain('automatisch de meerderheid');
  });

  it('forbids defaulting to NO_TRADE purely because systems disagree', () => {
    expect(SYSTEM_E_PHASE2_SYSTEM_PROMPT).toMatch(/NO_TRADE te kiezen puur omdat/);
  });

  it('requires methodologically careful wording about what A-D published vs. what they internally computed', () => {
    expect(SYSTEM_E_PHASE2_SYSTEM_PROMPT).toContain('gepubliceerde output');
    expect(SYSTEM_E_PHASE2_SYSTEM_PROMPT).toContain('niet expliciet meegewogen');
  });

  it('repeats the setup-quality rubric so phase 2 does not become more conservative than phase 1', () => {
    expect(SYSTEM_E_PHASE2_SYSTEM_PROMPT).toMatch(/B[- ]setup is een normaal, legitiem/);
  });

  it('includes phase 1\'s own decision in the phase 2 user content, proving continuity rather than a fresh restart', () => {
    const phase1: SystemEPhase1Result = {
      marketRegime: 'trend', higherTimeframeDirection: 'up', shortTermStructure: 'hh', momentum: 'rising',
      supportLevels: [], resistanceLevels: [], tradeLocationAssessment: 'ok', setupQuality: 'B', decision: 'LONG',
      confidence: 'medium', entryZone: null, invalidation: null, targets: [], riskRewardRatio: null,
      argumentsFor: [], argumentsAgainst: [], waitConditions: [], rejectionCheck: '',
    };
    const content = buildPhase2UserContent('BTCUSDT', phase1, []);
    expect(content).toContain('Voorlopig besluit: LONG');
  });
});
