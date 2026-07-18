/**
 * "Eigen logging" requirement: System E spends real money via the user's own
 * API key, so every call — success or failure — is logged with an estimated
 * cost, visible in the UI. Pricing is a point-in-time estimate (see
 * PRICING_USD_PER_MILLION_TOKENS) for transparency only, not a billing
 * source of truth — check the Anthropic Console for actual spend.
 */
import type { SystemEModel } from '../settings/apiKeyStore';

export interface SystemELogEntry {
  id: string;
  timestamp: number;
  symbol: string;
  success: boolean;
  errorType?: string;
  errorMessage?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
  estimatedCostUsd?: number;
}

const PRICING_USD_PER_MILLION_TOKENS: Record<SystemEModel, { input: number; output: number }> = {
  'claude-opus-4-8': { input: 5.0, output: 25.0 },
  'claude-sonnet-5': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5': { input: 1.0, output: 5.0 },
};

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number, cacheReadTokens: number, cacheCreationTokens: number): number | undefined {
  const pricing = PRICING_USD_PER_MILLION_TOKENS[model as SystemEModel];
  if (!pricing) return undefined;
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  const cacheReadCost = (cacheReadTokens / 1_000_000) * pricing.input * 0.1;
  const cacheCreationCost = (cacheCreationTokens / 1_000_000) * pricing.input * 1.25;
  return inputCost + outputCost + cacheReadCost + cacheCreationCost;
}

export function createLogEntry(symbol: string, now: number, outcome: { success: true; model: string; inputTokens: number; outputTokens: number; cacheReadInputTokens: number; cacheCreationInputTokens: number } | { success: false; errorType: string; errorMessage: string }): SystemELogEntry {
  if (outcome.success) {
    return {
      id: `${symbol}-log-${now}`,
      timestamp: now,
      symbol,
      success: true,
      model: outcome.model,
      inputTokens: outcome.inputTokens,
      outputTokens: outcome.outputTokens,
      cacheReadInputTokens: outcome.cacheReadInputTokens,
      cacheCreationInputTokens: outcome.cacheCreationInputTokens,
      estimatedCostUsd: estimateCostUsd(outcome.model, outcome.inputTokens, outcome.outputTokens, outcome.cacheReadInputTokens, outcome.cacheCreationInputTokens),
    };
  }
  return {
    id: `${symbol}-log-${now}`,
    timestamp: now,
    symbol,
    success: false,
    errorType: outcome.errorType,
    errorMessage: outcome.errorMessage,
  };
}
