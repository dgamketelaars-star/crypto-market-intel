import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { RawMarketSnapshot } from '../prompt/marketData';
import type { SystemOutputSummary } from '../prompt/systemSummary';
import type { SystemEPhase1Result } from '../prompt/phase1Schema';
import { runPhase1Analysis, runPhase2Analysis } from './runMetaAnalysis';

const anthropicCreate = vi.fn();
const openaiCreate = vi.fn();

vi.mock('../client/anthropicClient', () => ({
  createSystemEClient: () => ({ messages: { create: anthropicCreate } }),
}));
vi.mock('../client/openaiClient', () => ({
  createSystemEOpenAIClient: () => ({ chat: { completions: { create: openaiCreate } } }),
}));

const MARKET: RawMarketSnapshot = {
  symbol: 'BTCUSDT',
  price: 100,
  candles1h: [],
  candles4h: [],
  fundingRatePct: null,
  openInterestValue: null,
  longShortRatio: null,
  recentLiquidationCount: 0,
};

function validPhase1Json(): string {
  const result: SystemEPhase1Result = {
    marketRegime: 'trend',
    higherTimeframeDirection: 'up',
    shortTermStructure: 'hh',
    momentum: 'rising',
    supportLevels: [95],
    resistanceLevels: [105],
    tradeLocationAssessment: 'ok',
    setupQuality: 'B',
    decision: 'LONG',
    confidence: 'medium',
    entryZone: { low: 99, high: 101 },
    invalidation: 94,
    targets: [{ price: 110, reason: 'prior high' }],
    riskRewardRatio: 2,
    argumentsFor: ['a'],
    argumentsAgainst: ['b'],
    waitConditions: [],
    rejectionCheck: '',
  };
  return JSON.stringify(result);
}

beforeEach(() => {
  anthropicCreate.mockReset();
  openaiCreate.mockReset();
});

describe('runPhase1Analysis — Anthropic', () => {
  it('parses a successful structured response', async () => {
    anthropicCreate.mockResolvedValue({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: validPhase1Json() }],
      usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
      model: 'claude-opus-4-8',
    });
    const outcome = await runPhase1Analysis({ provider: 'anthropic', apiKey: 'sk-ant-test', model: 'claude-opus-4-8', market: MARKET });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.result.decision).toBe('LONG');
  });

  it('does NOT fabricate a NO_TRADE result on a refusal — it reports failure instead', async () => {
    anthropicCreate.mockResolvedValue({ stop_reason: 'refusal', content: [] });
    const outcome = await runPhase1Analysis({ provider: 'anthropic', apiKey: 'sk-ant-test', model: 'claude-opus-4-8', market: MARKET });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.errorType).toBe('refusal');
  });

  it('does NOT fabricate a NO_TRADE result on malformed JSON — it reports failure instead', async () => {
    anthropicCreate.mockResolvedValue({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: '{not valid json' }],
      usage: { input_tokens: 10, output_tokens: 5 },
      model: 'claude-opus-4-8',
    });
    const outcome = await runPhase1Analysis({ provider: 'anthropic', apiKey: 'sk-ant-test', model: 'claude-opus-4-8', market: MARKET });
    expect(outcome.ok).toBe(false);
  });

  it('does NOT fabricate a NO_TRADE result on an SDK/network error — it reports failure instead', async () => {
    anthropicCreate.mockRejectedValue(new Error('network down'));
    const outcome = await runPhase1Analysis({ provider: 'anthropic', apiKey: 'sk-ant-test', model: 'claude-opus-4-8', market: MARKET });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.errorType).toBe('unknown_error');
  });

  it('redacts an API key that leaks into an error message', async () => {
    anthropicCreate.mockRejectedValue(new Error('failed for key sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890'));
    const outcome = await runPhase1Analysis({ provider: 'anthropic', apiKey: 'sk-ant-test', model: 'claude-opus-4-8', market: MARKET });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.errorMessage).not.toContain('abcdefghijklmnopqrstuvwxyz1234567890');
    }
  });
});

describe('runPhase1Analysis — OpenAI', () => {
  it('parses a successful structured response', async () => {
    openaiCreate.mockResolvedValue({
      choices: [{ finish_reason: 'stop', message: { content: validPhase1Json() } }],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
      model: 'gpt-4o',
    });
    const outcome = await runPhase1Analysis({ provider: 'openai', apiKey: 'sk-test', model: 'gpt-4o', market: MARKET });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.result.setupQuality).toBe('B');
  });

  it('does NOT fabricate a NO_TRADE result on a content_filter refusal', async () => {
    openaiCreate.mockResolvedValue({ choices: [{ finish_reason: 'content_filter', message: { content: null } }] });
    const outcome = await runPhase1Analysis({ provider: 'openai', apiKey: 'sk-test', model: 'gpt-4o', market: MARKET });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.errorType).toBe('refusal');
  });
});

describe('runPhase2Analysis', () => {
  it('only ever runs with phase 1 explicitly passed in — never reconstructs it', async () => {
    const phase1: SystemEPhase1Result = JSON.parse(validPhase1Json());
    const summaries: SystemOutputSummary[] = [{ systemId: 'A', systemName: 'Onze analist', hasSetup: false, reasoning: [], warnings: [] }];
    anthropicCreate.mockResolvedValue({
      stop_reason: 'end_turn',
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            adSummary: 's', adAgreements: [], adDisagreements: [], adMissingSystems: ['A'], adLevelDifferences: [], sharedBlindSpotWarning: null,
            comparisonToPhase1: 'c', phase1DirectionRetained: true, finalDecision: 'LONG', finalConfidence: 'medium', finalSetupQuality: 'B',
            finalEntryZone: { low: 99, high: 101 }, finalInvalidation: 94, finalTargets: [{ price: 110, reason: 'x' }], finalRiskRewardRatio: 2,
            edgeSummary: 'e', keyRisk: 'r', invalidationCondition: 'i', waitConditions: [], motivation: 'm',
          }),
        },
      ],
      usage: { input_tokens: 10, output_tokens: 5 },
      model: 'claude-opus-4-8',
    });

    const outcome = await runPhase2Analysis({ provider: 'anthropic', apiKey: 'sk-ant-test', model: 'claude-opus-4-8', symbol: 'BTCUSDT', phase1, systemSummaries: summaries });
    expect(outcome.ok).toBe(true);
    // The call's user content must have included phase 1's own decision — proving phase 2 was built from the passed-in phase1, not from scratch.
    const sentUserContent = anthropicCreate.mock.calls[0][0].messages[0].content as string;
    expect(sentUserContent).toContain('LONG');
  });
});
