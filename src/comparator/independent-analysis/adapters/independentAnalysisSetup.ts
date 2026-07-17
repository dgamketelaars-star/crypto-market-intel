/**
 * Exact normalised interface from the Independent Open-Source Market-Analysis
 * Architecture research report — preserved verbatim. Missing fields stay
 * missing rather than invented.
 */
export type IndependentAnalysisDirection = 'LONG' | 'SHORT';

export type IndependentAnalysisSchool = 'market_structure' | 'liquidity' | 'volume_profile' | 'wyckoff' | 'orderflow' | 'other';

export type IndependentAnalysisStatus = 'observing' | 'waiting_for_trigger' | 'entry_zone_now' | 'active' | 'invalidated' | 'closed';

export type IndependentAnalysisTimeframe = 'DAY_TRADE' | 'SWING_TRADE';

export interface IndependentAnalysisSetup {
  systemId: 'SYSTEM_C';
  modelName: string;
  school: IndependentAnalysisSchool;

  symbol: string;
  direction: IndependentAnalysisDirection;
  status: IndependentAnalysisStatus;

  timeframe: IndependentAnalysisTimeframe;

  marketInterpretation: string;
  setupType: string;

  entryZone?: {
    low: number;
    high: number;
  };

  triggerCondition?: string;
  stopPrice?: number;

  targets?: Array<{
    price: number;
    reason: string;
    portion?: number;
  }>;

  invalidationReason: string;
  supportingObservations: string[];
  opposingObservations: string[];
  dataTimestamp: number;
}
