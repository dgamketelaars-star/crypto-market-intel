import type { SetupLevel, SetupTarget, TradeHorizon } from '../../setups/engine/types';
import type { RiskLevel, ThesisDirection } from '../thesis/types';

export type TradePlanRejectionReason =
  | 'no_structural_stack'
  | 'entry_missed'
  | 'stop_sanity_floor_failed'
  | 'no_valid_targets';

export interface TradePlanRejection {
  outcome: 'NO_PLAN';
  reason: TradePlanRejectionReason;
  detail: string;
}

export interface ValidTradePlan {
  outcome: 'VALID_PLAN';
  direction: ThesisDirection;
  horizon: TradeHorizon;
  entryZone: { low: number; high: number };
  /** The structural zone entry is built from — kept for lifecycle/explanation, mirrors the old engine's `trigger`. */
  trigger: SetupLevel;
  invalidation: SetupLevel;
  targets: SetupTarget[];
  risk: RiskLevel;
  riskFactors: string[];
}

export type TradePlanResult = ValidTradePlan | TradePlanRejection;
