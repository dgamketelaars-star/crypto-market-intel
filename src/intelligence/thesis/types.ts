import type { CategoryEvidence, EvidenceLayers } from '../evidence/types';
import type { MarketRegimeResult } from '../regime/types';

export type ThesisDirection = 'LONG' | 'SHORT';

export type NoThesisReason =
  | 'regime_unusable'
  | 'htf_structure_unclear'
  | 'layer_a_conflict'
  | 'no_directional_foundation'
  | 'no_entry_location'
  | 'insufficient_layer_b_confirmation'
  | 'layer_b_strong_contradiction'
  | 'layer_c_veto'
  | 'unresolved_opposing_evidence';

export interface ThesisRejection {
  outcome: 'NO_THESIS';
  reason: NoThesisReason;
  detail: string;
  /** Which candidate direction(s) were evaluated before rejection, for debugging/explanation. */
  evaluated: ThesisDirection[];
}

export type SignalStrength = 'Medium' | 'High' | 'Very high';

export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Very high';

export interface ValidThesis {
  outcome: 'VALID_LONG_THESIS' | 'VALID_SHORT_THESIS';
  direction: ThesisDirection;
  layers: EvidenceLayers;
  regime: MarketRegimeResult;
  /** Layer C categories that tightened confirmation requirements or capped strength, for explanation UI. */
  contextAdjustments: string[];
  signalStrength: SignalStrength;
  narrative: string;
}

export type ThesisResult = ValidThesis | ThesisRejection;

/** One category's "does it lean the same way as `bias`" read, used by Layer B confirmation. */
export function leansWith(bias: ThesisDirection, evidence: CategoryEvidence): boolean {
  return bias === 'LONG'
    ? evidence.conclusion === 'bullish' || evidence.conclusion === 'slightly_bullish'
    : evidence.conclusion === 'bearish' || evidence.conclusion === 'slightly_bearish';
}

/** Only the *full* opposite conclusion counts as strong opposition — "slightly" opposite is a tolerated headwind. */
export function stronglyOpposes(bias: ThesisDirection, evidence: CategoryEvidence): boolean {
  return bias === 'LONG' ? evidence.conclusion === 'bearish' : evidence.conclusion === 'bullish';
}
