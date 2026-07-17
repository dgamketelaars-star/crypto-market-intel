/**
 * Exact normalised interface from the Open-Source Crypto Setup Comparator
 * research report — preserved verbatim. Optional fields stay optional:
 * missing data must never be invented to make System A and System B look
 * more alike than they are.
 */
export type SetupDirection = 'LONG' | 'SHORT';

export interface NormalisedStrategySetup {
  systemId: 'EXPLAINABLE_ANALYST' | 'OPEN_SOURCE_BASELINE_V1';
  symbol: string;
  direction: SetupDirection;
  strategyName: string;
  strategyVersion: string;
  status: 'approaching' | 'entry_triggered' | 'active' | 'closed' | 'invalidated';
  detectedAt: number;
  triggerPrice?: number;
  entryZone?: {
    low: number;
    high: number;
  };
  stopPrice?: number;
  targets?: Array<{
    price: number;
    portion?: number;
  }>;
  exitMethod: string;
  expectedTimeframe?: string;
  reasonSummary: string[];
  sourceDataTimestamp: number;
}
