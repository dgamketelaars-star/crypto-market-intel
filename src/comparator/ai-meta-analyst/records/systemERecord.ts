import type { SystemOutputSummary } from '../prompt/systemSummary';
import type { SystemEPhase1Result } from '../prompt/phase1Schema';
import type { SystemEPhase2Result } from '../prompt/phase2Schema';
import type { RunMetaAnalysisUsage } from '../analysis/runMetaAnalysis';
import type { SelectionReason } from '../selection/selectSymbolsToAnalyze';
import type { SystemEProvider } from '../settings/apiKeyStore';

export type SystemETriggerType = 'automatic' | 'manual';

/**
 * Stores phase 1 (independent, pre-A-D) and phase 2 (final, post-A-D)
 * results SEPARATELY, per Deel 4/8 of the brief — this is what makes it
 * possible to check later whether A-D actually changed anything, instead of
 * only ever seeing the final, possibly-anchored answer.
 */
export interface SystemERecord {
  id: string;
  symbol: string;
  generatedAt: number;
  provider: SystemEProvider;
  model: string;
  triggerType: SystemETriggerType;
  /** Why this symbol was selected automatically; null for a manual "analyseer nu" trigger. */
  selectionReason: SelectionReason | null;
  inputSystemsSnapshot: SystemOutputSummary[];
  phase1: SystemEPhase1Result;
  phase2: SystemEPhase2Result;
  phase1Usage: RunMetaAnalysisUsage;
  phase2Usage: RunMetaAnalysisUsage;
}

export function createSystemERecord(
  symbol: string,
  provider: SystemEProvider,
  model: string,
  triggerType: SystemETriggerType,
  selectionReason: SelectionReason | null,
  inputSystemsSnapshot: SystemOutputSummary[],
  phase1: SystemEPhase1Result,
  phase2: SystemEPhase2Result,
  phase1Usage: RunMetaAnalysisUsage,
  phase2Usage: RunMetaAnalysisUsage,
  now: number,
): SystemERecord {
  return {
    id: `${symbol}-E-${now}`,
    symbol,
    generatedAt: now,
    provider,
    model,
    triggerType,
    selectionReason,
    inputSystemsSnapshot,
    phase1,
    phase2,
    phase1Usage,
    phase2Usage,
  };
}

/** True when phase 2 kept phase 1's decision — surfaced directly rather than only via the model's self-reported phase1DirectionRetained field, so the UI/log can trust an independently-computed fact even if the model's self-report is inconsistent. */
export function decisionChangedAfterReadingAD(record: SystemERecord): boolean {
  return record.phase1.decision !== record.phase2.finalDecision;
}
