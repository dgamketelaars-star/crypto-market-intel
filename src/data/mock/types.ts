export type Direction = 'LONG' | 'SHORT';

export type SignalRating = 'Strong Buy' | 'Buy' | 'Watch' | 'Sell' | 'Strong Sell';

export type Level = 'Low' | 'Medium' | 'High';

export type SetupStatus = 'Active' | 'Waiting for confirmation' | 'Invalidated' | 'Closed';

export interface KeyFact {
  /** Short label, may contain glossary terms — rendered through TermText. */
  label: string;
}

export interface SetupReasoning {
  supporting: string[];
  against: string[];
  nextStep: string;
  mindChange: string;
}

export interface TechnicalDetail {
  label: string;
  value: string;
}

export type SourceCategory =
  | 'Marktdata'
  | 'Technische analyse'
  | 'On-chain data'
  | 'Social data'
  | 'External risk';

export interface SourceRef {
  category: SourceCategory;
  detail: string;
}

export interface Setup {
  id: string;
  pair: string;
  direction: Direction;
  signal: SignalRating;
  signalStrength: Level;
  risk: Level;
  expectedDuration: string;
  status: SetupStatus;
  keyFacts: KeyFact[];
  summary: string;
  trigger: string;
  invalidation: string;
  entryZone?: string;
  targets?: string[];
  reasoning: SetupReasoning;
  technicalDetails: TechnicalDetail[];
  sources: SourceRef[];
}

export interface MarketContextDetailItem {
  label: string;
  text: string;
}

export interface MarketContextData {
  status: string;
  btcTrend: string;
  ethTrend: string;
  volatility: string;
  externalRisk: string;
  summary: string;
  details: MarketContextDetailItem[];
}

export interface ExternalRiskEvent {
  id: string;
  title: string;
  window: string;
  relevance: string;
}
