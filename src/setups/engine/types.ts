import type { CandleInterval } from '../../services/binance/types';

export type SetupDirection = 'LONG' | 'SHORT';

/**
 * Every setup is classified into exactly one of these before its entry,
 * stop and targets are finalized — the classification then determines
 * which ATR (1H vs 4H) governs the minimum stop/target distance rules.
 * There is no "unclassified" or "scalp" state: a setup that doesn't clearly
 * fit either horizon is rejected outright, never generated at all.
 * See tradeHorizon.ts for the classification rules.
 */
export type TradeHorizon = 'DAY_TRADE' | 'SWING_TRADE';

export type SetupFamily =
  | 'trend_continuation_breakout'
  | 'trend_continuation_pullback'
  | 'range_breakout'
  | 'failed_breakout_reversal'
  | 'momentum_divergence_reversal'
  | 'volatility_compression_breakout'
  /** Produced by the intelligence/evidence pipeline (src/intelligence/) — a single evidence-synthesized thesis, not a pattern family. */
  | 'evidence_based_thesis';

export type SetupStatus =
  | 'candidate'
  | 'waiting_for_confirmation'
  | 'active'
  | 'invalidated'
  | 'completed'
  | 'expired';

export const OPEN_SETUP_STATUSES: SetupStatus[] = ['candidate', 'waiting_for_confirmation', 'active'];
export const CLOSED_SETUP_STATUSES: SetupStatus[] = ['invalidated', 'completed', 'expired'];

export type SetupStrength = 'Low' | 'Medium' | 'High' | 'Very high';
export type SetupRisk = 'Low' | 'Medium' | 'High' | 'Very high';

export interface SetupCondition {
  key: string;
  label: string;
  met: boolean;
  detail: string;
}

export interface SetupLevel {
  price: number;
  timeframe: CandleInterval;
  method: string;
  explanation: string;
}

/** What a setup family/level-builder produces — a defensible price level, not yet ordered or sized. */
export interface SetupTargetCandidate extends SetupLevel {
  rewardToRisk: number | null;
}

export type TargetStatus = 'pending' | 'reached' | 'completed';

/** A finalized, ordered, sized target — assembled centrally so every family gets the same staged-exit rules. */
export interface SetupTarget extends SetupTargetCandidate {
  order: number;
  /** Suggested % of the position to close at this level (example plan only) — all targets for a setup sum to 100. */
  positionPortionPct: number;
  /** The last target in the plan — reaching it closes the whole setup as completed. */
  isFinal: boolean;
  status: TargetStatus;
}

export interface SetupEvidence {
  group:
    | 'trend'
    | 'momentum'
    | 'volume'
    | 'market_structure'
    | 'volatility'
    | 'futures_positioning'
    | 'btc_eth_context'
    /** Intelligence-pipeline-only groups (see src/intelligence/lifecycle/convertToSetupEvidence.ts). */
    | 'market_regime'
    | 'risk_conflict';
  label: string;
  detail: string;
}

export type LifecycleEventType =
  | 'candidate_created'
  | 'trigger_approached'
  | 'confirmation_received'
  | 'setup_activated'
  | 'strength_changed'
  | 'risk_changed'
  | 'context_adjustment'
  | 'target_reached'
  | 'setup_invalidated'
  | 'setup_completed'
  | 'setup_expired';

export interface SetupLifecycleEvent {
  timestamp: number;
  type: LifecycleEventType;
  detail: string;
}

export type MarketContextEffect = 'requires_stronger_confirmation' | 'downgraded' | 'invalidated' | 'none';

export interface MarketContextAdjustment {
  applied: boolean;
  reason: string;
  effect: MarketContextEffect;
}

/** Recorded once, at the moment of activation, and never rewritten afterward. */
export interface EntryInfo {
  activatedAt: number;
  triggerPrice: number;
  /** First live price observed at/after confirmation — the honest "entry" price for distance/excursion math. */
  firstLivePrice: number;
  entryZone: { low: number; high: number } | null;
  /** Best price reached since entry, in the position's favour (LONG: max seen, SHORT: min seen). */
  highestFavorableExcursion: number;
  /** Worst price reached since entry, against the position (LONG: min seen, SHORT: max seen). */
  largestAdverseExcursion: number;
  /** True when price had already moved beyond the ATR-based allowed entry distance by the time we saw it. */
  entryMissed: boolean;
}

export interface DirectionRejection {
  rejectedDirection: SetupDirection;
  reason: string;
}

/**
 * Timestamp of the most recent meaningful change to each plan field —
 * powers the "⚠️ Instapzone gewijzigd" style inline warnings. Only tracked
 * while a setup is still forming (candidate/waiting_for_confirmation); once
 * a setup activates, its entry zone/invalidation/targets freeze for good
 * (see lifecycle.ts), so this is reset to all-null at the moment of
 * activation and never changes again after that.
 */
export interface SetupChangeLog {
  entryZone: number | null;
  invalidation: number | null;
  targets: number | null;
}

export interface GeneratedSetup {
  id: string;
  symbol: string;
  direction: SetupDirection;
  family: SetupFamily;
  status: SetupStatus;
  createdAt: number;
  lastEvaluatedAt: number;
  tradeHorizon: TradeHorizon;
  expectedDuration: string;
  signalStrength: SetupStrength;
  risk: SetupRisk;
  trigger: SetupLevel;
  invalidation: SetupLevel;
  entryZone: { low: number; high: number } | null;
  targets: SetupTarget[];
  supporting: SetupEvidence[];
  opposing: SetupEvidence[];
  missingData: SetupEvidence[];
  marketContext: MarketContextAdjustment;
  ruleVersion: string;
  sourceDataTimestamps: { symbol: number; btc: number | null };
  lifecycle: SetupLifecycleEvent[];
  origin: 'live' | 'simulation';
  closedAt: number | null;
  closedReason: 'target' | 'invalidation' | 'expired' | null;
  /** The live price at the moment of closing — only set when the setup had actually activated (never for a candidate/waiting setup that expires or invalidates before entry). */
  closedPrice: number | null;
  entry: EntryInfo | null;
  directionRejection: DirectionRejection | null;
  changeLog: SetupChangeLog;
}
