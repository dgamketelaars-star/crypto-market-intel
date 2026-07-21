/**
 * "Eigen logging" requirement (Deel 8): every analysis — success or
 * failure, automatic or manual — is logged with enough structure to later
 * study System E's behaviour: what it concluded independently, what it
 * concluded after reading A-D, whether that changed, why it was selected,
 * and what it cost. Pricing is a point-in-time estimate (see
 * PRICING_USD_PER_MILLION_TOKENS) for transparency only, not a billing
 * source of truth — check the provider's own console for actual spend.
 */
import type { SystemEModel, SystemEProvider } from '../settings/apiKeyStore';
import type { SelectionReason } from '../selection/selectSymbolsToAnalyze';
import type { SystemEDecision, SystemEConfidence } from '../prompt/phase1Schema';
import type { SetupQuality } from '../prompt/setupQuality';
import type { SystemERecord, SystemETriggerType } from '../records/systemERecord';
import { decisionChangedAfterReadingAD } from '../records/systemERecord';
import type { RunMetaAnalysisUsage } from '../analysis/runMetaAnalysis';

export interface SystemELogEntry {
  id: string;
  timestamp: number;
  symbol: string;
  success: boolean;
  triggerType: SystemETriggerType;
  selectionReason?: SelectionReason | null;
  errorPhase?: 'phase1' | 'phase2';
  errorType?: string;
  errorMessage?: string;
  provider?: SystemEProvider;
  model?: string;
  initialDecision?: SystemEDecision;
  initialConfidence?: SystemEConfidence;
  initialSetupQuality?: SetupQuality;
  finalDecision?: SystemEDecision;
  finalConfidence?: SystemEConfidence;
  finalSetupQuality?: SetupQuality;
  decisionChangedAfterAD?: boolean;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
  estimatedCostUsd?: number;
}

/**
 * cacheReadDiscount: fraction of the input price charged for cached tokens
 * (Anthropic ~90% off, OpenAI ~50% off — different providers, different
 * caching economics). cacheWriteMultiplier: extra cost of writing to cache,
 * Anthropic-only — OpenAI's automatic prompt caching has no separate write
 * cost, so it's omitted (treated as 0) for OpenAI models.
 */
const PRICING_USD_PER_MILLION_TOKENS: Record<SystemEModel, { input: number; output: number; cacheReadDiscount: number; cacheWriteMultiplier: number }> = {
  'claude-opus-4-8': { input: 5.0, output: 25.0, cacheReadDiscount: 0.1, cacheWriteMultiplier: 1.25 },
  'claude-sonnet-5': { input: 3.0, output: 15.0, cacheReadDiscount: 0.1, cacheWriteMultiplier: 1.25 },
  'claude-haiku-4-5': { input: 1.0, output: 5.0, cacheReadDiscount: 0.1, cacheWriteMultiplier: 1.25 },
  'gpt-4o': { input: 2.5, output: 10.0, cacheReadDiscount: 0.5, cacheWriteMultiplier: 0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6, cacheReadDiscount: 0.5, cacheWriteMultiplier: 0 },
};

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number, cacheReadTokens: number, cacheCreationTokens: number): number | undefined {
  const pricing = PRICING_USD_PER_MILLION_TOKENS[model as SystemEModel];
  if (!pricing) return undefined;
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  const cacheReadCost = (cacheReadTokens / 1_000_000) * pricing.input * pricing.cacheReadDiscount;
  const cacheCreationCost = (cacheCreationTokens / 1_000_000) * pricing.input * pricing.cacheWriteMultiplier;
  return inputCost + outputCost + cacheReadCost + cacheCreationCost;
}

function sumUsage(a: RunMetaAnalysisUsage, b: RunMetaAnalysisUsage): RunMetaAnalysisUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadInputTokens: a.cacheReadInputTokens + b.cacheReadInputTokens,
    cacheCreationInputTokens: a.cacheCreationInputTokens + b.cacheCreationInputTokens,
  };
}

/** Successful two-phase analysis -> one combined log entry (token/cost totals across both calls). */
export function createSuccessLogEntry(record: SystemERecord): SystemELogEntry {
  const usage = sumUsage(record.phase1Usage, record.phase2Usage);
  return {
    id: record.id,
    timestamp: record.generatedAt,
    symbol: record.symbol,
    success: true,
    triggerType: record.triggerType,
    selectionReason: record.selectionReason,
    provider: record.provider,
    model: record.model,
    initialDecision: record.phase1.decision,
    initialConfidence: record.phase1.confidence,
    initialSetupQuality: record.phase1.setupQuality,
    finalDecision: record.phase2.finalDecision,
    finalConfidence: record.phase2.finalConfidence,
    finalSetupQuality: record.phase2.finalSetupQuality,
    decisionChangedAfterAD: decisionChangedAfterReadingAD(record),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheReadInputTokens: usage.cacheReadInputTokens,
    cacheCreationInputTokens: usage.cacheCreationInputTokens,
    estimatedCostUsd: estimateCostUsd(record.model, usage.inputTokens, usage.outputTokens, usage.cacheReadInputTokens, usage.cacheCreationInputTokens),
  };
}

export interface FailureLogEntryOptions {
  symbol: string;
  now: number;
  triggerType: SystemETriggerType;
  selectionReason: SelectionReason | null;
  errorPhase: 'phase1' | 'phase2';
  errorType: string;
  errorMessage: string;
  provider?: SystemEProvider;
  model?: string;
  /** Only set when phase 1 succeeded and phase 2 then failed — preserves the independent conclusion instead of losing it entirely. */
  phase1Usage?: RunMetaAnalysisUsage;
  initialDecision?: SystemEDecision;
  initialConfidence?: SystemEConfidence;
  initialSetupQuality?: SetupQuality;
}

export function createFailureLogEntry(options: FailureLogEntryOptions): SystemELogEntry {
  const { symbol, now, triggerType, selectionReason, errorPhase, errorType, errorMessage, provider, model, phase1Usage, initialDecision, initialConfidence, initialSetupQuality } = options;
  return {
    id: `${symbol}-log-${now}`,
    timestamp: now,
    symbol,
    success: false,
    triggerType,
    selectionReason,
    errorPhase,
    errorType,
    errorMessage,
    provider,
    model,
    initialDecision,
    initialConfidence,
    initialSetupQuality,
    inputTokens: phase1Usage?.inputTokens,
    outputTokens: phase1Usage?.outputTokens,
    cacheReadInputTokens: phase1Usage?.cacheReadInputTokens,
    cacheCreationInputTokens: phase1Usage?.cacheCreationInputTokens,
    estimatedCostUsd: phase1Usage && model ? estimateCostUsd(model, phase1Usage.inputTokens, phase1Usage.outputTokens, phase1Usage.cacheReadInputTokens, phase1Usage.cacheCreationInputTokens) : undefined,
  };
}
