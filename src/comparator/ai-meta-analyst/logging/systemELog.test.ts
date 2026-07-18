import { describe, expect, it } from 'vitest';
import { createLogEntry, estimateCostUsd } from './systemELog';

describe('estimateCostUsd', () => {
  it('computes cost from input/output tokens at the model\'s per-million pricing', () => {
    const cost = estimateCostUsd('claude-opus-4-8', 1_000_000, 1_000_000, 0, 0);
    expect(cost).toBeCloseTo(5.0 + 25.0, 5);
  });

  it('prices cache reads at roughly 0.1x and cache writes at roughly 1.25x the input rate', () => {
    const cost = estimateCostUsd('claude-opus-4-8', 0, 0, 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(5.0 * 0.1 + 5.0 * 1.25, 5);
  });

  it('returns undefined for an unknown model rather than guessing a price', () => {
    expect(estimateCostUsd('some-future-model', 1000, 1000, 0, 0)).toBeUndefined();
  });
});

describe('createLogEntry', () => {
  const NOW = 1_700_000_000_000;

  it('builds a success entry with an estimated cost attached', () => {
    const entry = createLogEntry('BTCUSDT', NOW, { success: true, model: 'claude-haiku-4-5', inputTokens: 1000, outputTokens: 500, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 });
    expect(entry.success).toBe(true);
    expect(entry.estimatedCostUsd).toBeGreaterThan(0);
  });

  it('builds a failure entry with the error type and message, no cost fields', () => {
    const entry = createLogEntry('BTCUSDT', NOW, { success: false, errorType: 'rate_limit_error', errorMessage: 'Rate limit bereikt' });
    expect(entry.success).toBe(false);
    expect(entry.errorType).toBe('rate_limit_error');
    expect(entry.estimatedCostUsd).toBeUndefined();
  });
});
