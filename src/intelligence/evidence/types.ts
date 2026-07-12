import type { CandleInterval } from '../../services/binance/types';

/**
 * The 7-value conclusion scale every evidence category reduces to. Kept
 * deliberately coarse and typed (never a raw numeric score) so categories
 * stay comparable without collapsing into a flat point system — see
 * src/intelligence/thesis/decisionFlow.ts for how these combine.
 */
export type EvidenceConclusion =
  | 'bullish'
  | 'slightly_bullish'
  | 'neutral'
  | 'slightly_bearish'
  | 'bearish'
  | 'conflicted'
  | 'insufficient_data';

export const EVIDENCE_CATEGORY_IDS = [
  'market_regime',
  'higher_timeframe_structure',
  'entry_location_quality',
  'trend',
  'momentum',
  'volume',
  'volatility',
  'derivatives_positioning',
  'btc_eth_context',
  'risk_conflict',
] as const;

export type EvidenceCategoryId = (typeof EVIDENCE_CATEGORY_IDS)[number];

/**
 * One fact backing (or opposing) a category's conclusion. Always traceable
 * to a concrete calculation and timeframe/source — this is what keeps the
 * eventual thesis explainable instead of a black box.
 */
export interface EvidenceFact {
  description: string;
  timeframe: CandleInterval | 'multi' | null;
  sourceTimestamp: number;
}

/**
 * The shared shape every evidence category (Layer B and Layer C) produces.
 * Layer A categories extend this with a gate — see LayerACategoryEvidence
 * below.
 */
export interface CategoryEvidence {
  category: EvidenceCategoryId;
  conclusion: EvidenceConclusion;
  supporting: EvidenceFact[];
  opposing: EvidenceFact[];
  missingData: string[];
  timeframe: CandleInterval | 'multi' | null;
  sourceTimestamp: number;
}

export type LayerAGateStatus = 'usable' | 'blocked';

/**
 * Layer A (market_regime, higher_timeframe_structure, entry_location_quality)
 * separates "is this signal usable at all" (gateStatus) from "which way does
 * it lean" (bias). A blocked gate is terminal — see decisionFlow.ts step 1.
 */
export interface LayerACategoryEvidence extends CategoryEvidence {
  gateStatus: LayerAGateStatus;
  /** Only meaningful when gateStatus === 'usable'. */
  bias: 'bullish' | 'bearish' | 'neutral';
  /** Populated when gateStatus === 'blocked' — the exact reason a hard gate failed. */
  blockedReason: string | null;
}

export interface EvidenceLayers {
  layerA: {
    marketRegime: LayerACategoryEvidence;
    higherTimeframeStructure: LayerACategoryEvidence;
    /**
     * Entry-location quality is evaluated per candidate direction (see
     * decisionFlow.ts step 2b) — a symbol can have a defensible LONG zone,
     * a defensible SHORT zone, both, or neither, independent of each other.
     */
    entryLocationQuality: Record<'LONG' | 'SHORT', LayerACategoryEvidence>;
  };
  layerB: {
    trend: CategoryEvidence;
    momentum: CategoryEvidence;
    volume: CategoryEvidence;
  };
  layerC: {
    volatility: CategoryEvidence;
    derivativesPositioning: CategoryEvidence;
    btcEthContext: CategoryEvidence;
    riskConflict: CategoryEvidence;
  };
}
