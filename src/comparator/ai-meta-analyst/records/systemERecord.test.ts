import { describe, expect, it } from 'vitest';
import { createSystemERecord, decisionChangedAfterReadingAD } from './systemERecord';
import type { SystemEPhase1Result } from '../prompt/phase1Schema';
import type { SystemEPhase2Result } from '../prompt/phase2Schema';
import type { RunMetaAnalysisUsage } from '../analysis/runMetaAnalysis';

const NOW = 1_700_000_000_000;
const USAGE: RunMetaAnalysisUsage = { inputTokens: 100, outputTokens: 50, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 };

function phase1(decision: SystemEPhase1Result['decision'] = 'LONG'): SystemEPhase1Result {
  return {
    marketRegime: 'trend',
    higherTimeframeDirection: 'up',
    shortTermStructure: 'hh',
    momentum: 'rising',
    supportLevels: [],
    resistanceLevels: [],
    tradeLocationAssessment: 'ok',
    setupQuality: 'B',
    decision,
    confidence: 'medium',
    entryZone: null,
    invalidation: null,
    targets: [],
    riskRewardRatio: null,
    argumentsFor: [],
    argumentsAgainst: [],
    waitConditions: [],
    rejectionCheck: '',
  };
}

function phase2(finalDecision: SystemEPhase2Result['finalDecision'] = 'LONG'): SystemEPhase2Result {
  return {
    adSummary: '',
    adAgreements: [],
    adDisagreements: [],
    adMissingSystems: [],
    adLevelDifferences: [],
    sharedBlindSpotWarning: null,
    comparisonToPhase1: '',
    phase1DirectionRetained: finalDecision === 'LONG',
    finalDecision,
    finalConfidence: 'medium',
    finalSetupQuality: 'B',
    finalEntryZone: null,
    finalInvalidation: null,
    finalTargets: [],
    finalRiskRewardRatio: null,
    edgeSummary: '',
    keyRisk: '',
    invalidationCondition: '',
    waitConditions: [],
    motivation: '',
  };
}

describe('createSystemERecord', () => {
  it('stores phase 1 and phase 2 as separate, independently readable fields', () => {
    const record = createSystemERecord('BTCUSDT', 'anthropic', 'claude-opus-4-8', 'automatic', 'strong_consensus', [], phase1('LONG'), phase2('WAIT'), USAGE, USAGE, NOW);
    // Phase 1's own conclusion must survive untouched even though phase 2 revised it.
    expect(record.phase1.decision).toBe('LONG');
    expect(record.phase2.finalDecision).toBe('WAIT');
    expect(record.id).toBe(`BTCUSDT-E-${NOW}`);
  });

  it('records a null selectionReason for a manual trigger', () => {
    const record = createSystemERecord('ETHUSDT', 'openai', 'gpt-4o', 'manual', null, [], phase1(), phase2(), USAGE, USAGE, NOW);
    expect(record.triggerType).toBe('manual');
    expect(record.selectionReason).toBeNull();
  });
});

describe('decisionChangedAfterReadingAD', () => {
  it('returns false when phase 2 keeps phase 1\'s decision', () => {
    const record = createSystemERecord('BTCUSDT', 'anthropic', 'claude-opus-4-8', 'automatic', 'strong_consensus', [], phase1('LONG'), phase2('LONG'), USAGE, USAGE, NOW);
    expect(decisionChangedAfterReadingAD(record)).toBe(false);
  });

  it('returns true when phase 2 revises phase 1\'s decision', () => {
    const record = createSystemERecord('BTCUSDT', 'anthropic', 'claude-opus-4-8', 'automatic', 'disagreement', [], phase1('LONG'), phase2('NO_TRADE'), USAGE, USAGE, NOW);
    expect(decisionChangedAfterReadingAD(record)).toBe(true);
  });

  it('is computed independently of the model\'s self-reported phase1DirectionRetained flag', () => {
    // phase2() sets phase1DirectionRetained based on finalDecision === 'LONG' as a stand-in for a
    // self-report that could in principle be wrong/inconsistent — the real check must not trust it blindly.
    const inconsistent = phase2('SHORT');
    const record = createSystemERecord('BTCUSDT', 'anthropic', 'claude-opus-4-8', 'automatic', 'disagreement', [], phase1('LONG'), inconsistent, USAGE, USAGE, NOW);
    expect(decisionChangedAfterReadingAD(record)).toBe(true);
  });
});
