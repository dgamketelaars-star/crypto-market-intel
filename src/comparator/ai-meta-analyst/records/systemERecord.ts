import type { SystemOutputSummary } from '../prompt/buildPrompt';
import type { SystemEAnalysisResult } from '../prompt/outputSchema';
import type { RunMetaAnalysisUsage } from '../analysis/runMetaAnalysis';
import type { SelectionReason } from '../selection/selectSymbolsToAnalyze';

export interface SystemERecord {
  id: string;
  symbol: string;
  generatedAt: number;
  model: string;
  selectionReason: SelectionReason;
  inputSystemsSnapshot: SystemOutputSummary[];
  result: SystemEAnalysisResult;
  usage: RunMetaAnalysisUsage;
}

export function createSystemERecord(
  symbol: string,
  model: string,
  selectionReason: SelectionReason,
  inputSystemsSnapshot: SystemOutputSummary[],
  result: SystemEAnalysisResult,
  usage: RunMetaAnalysisUsage,
  now: number,
): SystemERecord {
  return {
    id: `${symbol}-E-${now}`,
    symbol,
    generatedAt: now,
    model,
    selectionReason,
    inputSystemsSnapshot,
    result,
    usage,
  };
}
