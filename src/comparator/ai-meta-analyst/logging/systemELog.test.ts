import { describe, expect, it } from 'vitest';
import { createFailureLogEntry, createSuccessLogEntry, estimateCostUsd } from './systemELog';
import { createSystemERecord } from '../records/systemERecord';
import type { SystemEPhase1Result } from '../prompt/phase1Schema';
import type { SystemEPhase2Result } from '../prompt/phase2Schema';
import type { RunMetaAnalysisUsage } from '../analysis/runMetaAnalysis';

const NOW = 1_700_000_000_000;

function phase1(overrides: Partial<SystemEPhase1Result> = {}): SystemEPhase1Result {
  return {
    marketRegime: 'trend',
    higherTimeframeDirection: 'up',
    shortTermStructure: 'higher highs',
    momentum: 'rising',
    supportLevels: [95],
    resistanceLevels: [105],
    tradeLocationAssessment: 'near support',
    setupQuality: 'B',
    decision: 'LONG',
    confidence: 'medium',
    entryZone: { low: 99, high: 101 },
    invalidation: 94,
    targets: [{ price: 110, reason: 'prior high' }],
    riskRewardRatio: 2.2,
    argumentsFor: ['uptrend intact'],
    argumentsAgainst: ['thin volume'],
    waitConditions: [],
    rejectionCheck: '',
    ...overrides,
  };
}

function phase2(overrides: Partial<SystemEPhase2Result> = {}): SystemEPhase2Result {
  return {
    adSummary: 'summary',
    adAgreements: [],
    adDisagreements: [],
    adMissingSystems: [],
    adLevelDifferences: [],
    sharedBlindSpotWarning: null,
    comparisonToPhase1: 'matches',
    phase1DirectionRetained: true,
    finalDecision: 'LONG',
    finalConfidence: 'medium',
    finalSetupQuality: 'B',
    finalEntryZone: { low: 99, high: 101 },
    finalInvalidation: 94,
    finalTargets: [{ price: 110, reason: 'prior high' }],
    finalRiskRewardRatio: 2.2,
    edgeSummary: 'edge',
    keyRisk: 'risk',
    invalidationCondition: 'break below 94',
    waitConditions: [],
    motivation: 'motivation',
    ...overrides,
  };
}

const USAGE: RunMetaAnalysisUsage = { inputTokens: 1000, outputTokens: 500, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 };

describe('estimateCostUsd', () => {
  it('computes cost from input/output tokens at the model\'s per-million pricing', () => {
    const cost = estimateCostUsd('claude-opus-4-8', 1_000_000, 1_000_000, 0, 0);
    expect(cost).toBeCloseTo(5.0 + 25.0, 5);
  });

  it('prices cache reads at roughly 0.1x and cache writes at roughly 1.25x the input rate for Anthropic', () => {
    const cost = estimateCostUsd('claude-opus-4-8', 0, 0, 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(5.0 * 0.1 + 5.0 * 1.25, 5);
  });

  it('prices OpenAI cache reads at 0.5x with no cache-write premium', () => {
    const cost = estimateCostUsd('gpt-4o', 0, 0, 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(2.5 * 0.5, 5);
  });

  it('returns undefined for an unknown model rather than guessing a price', () => {
    expect(estimateCostUsd('some-future-model', 1000, 1000, 0, 0)).toBeUndefined();
  });
});

describe('createSuccessLogEntry', () => {
  it('sums token usage and cost across both phases', () => {
    const record = createSystemERecord('BTCUSDT', 'anthropic', 'claude-opus-4-8', 'automatic', 'strong_consensus', [], phase1(), phase2(), USAGE, USAGE, NOW);
    const entry = createSuccessLogEntry(record);
    expect(entry.inputTokens).toBe(2000);
    expect(entry.outputTokens).toBe(1000);
    expect(entry.success).toBe(true);
    expect(entry.estimatedCostUsd).toBeGreaterThan(0);
  });

  it('captures the initial (phase 1) and final (phase 2) decision separately, and whether it changed', () => {
    const record = createSystemERecord(
      'BTCUSDT',
      'anthropic',
      'claude-opus-4-8',
      'automatic',
      'disagreement',
      [],
      phase1({ decision: 'LONG' }),
      phase2({ finalDecision: 'WAIT' }),
      USAGE,
      USAGE,
      NOW,
    );
    const entry = createSuccessLogEntry(record);
    expect(entry.initialDecision).toBe('LONG');
    expect(entry.finalDecision).toBe('WAIT');
    expect(entry.decisionChangedAfterAD).toBe(true);
  });

  it('records no change when phase 2 keeps phase 1\'s decision', () => {
    const record = createSystemERecord('BTCUSDT', 'openai', 'gpt-4o', 'manual', null, [], phase1({ decision: 'LONG' }), phase2({ finalDecision: 'LONG' }), USAGE, USAGE, NOW);
    const entry = createSuccessLogEntry(record);
    expect(entry.decisionChangedAfterAD).toBe(false);
    expect(entry.triggerType).toBe('manual');
    expect(entry.selectionReason).toBeNull();
  });
});

describe('createFailureLogEntry', () => {
  it('builds a phase1 failure entry with no cost fields (no usage yet)', () => {
    const entry = createFailureLogEntry({
      symbol: 'BTCUSDT',
      now: NOW,
      triggerType: 'automatic',
      selectionReason: 'strong_consensus',
      errorPhase: 'phase1',
      errorType: 'rate_limit_error',
      errorMessage: 'Rate limit bereikt',
    });
    expect(entry.success).toBe(false);
    expect(entry.errorPhase).toBe('phase1');
    expect(entry.estimatedCostUsd).toBeUndefined();
  });

  it('preserves phase 1\'s conclusion when phase 2 fails, instead of losing it', () => {
    const entry = createFailureLogEntry({
      symbol: 'BTCUSDT',
      now: NOW,
      triggerType: 'automatic',
      selectionReason: 'strong_consensus',
      errorPhase: 'phase2',
      errorType: 'rate_limit_error',
      errorMessage: 'Rate limit bereikt',
      provider: 'anthropic',
      model: 'claude-opus-4-8',
      phase1Usage: USAGE,
      initialDecision: 'LONG',
      initialConfidence: 'medium',
      initialSetupQuality: 'B',
    });
    expect(entry.initialDecision).toBe('LONG');
    expect(entry.initialSetupQuality).toBe('B');
    expect(entry.estimatedCostUsd).toBeGreaterThan(0);
  });
});
