import type { CategoryEvidence, LayerACategoryEvidence } from '../evidence/types';
import type { SignalStrength, ThesisDirection } from './types';
import { leansWith } from './types';

export interface SignalStrengthInput {
  direction: ThesisDirection;
  structureEvidence: LayerACategoryEvidence;
  /** [trend, momentum, volume] — already confirmed at least 2-of-3 agree, or decisionFlow would have rejected before reaching here. */
  layerBCategories: CategoryEvidence[];
  /** [derivativesPositioning, btcEthContext] — volatility and risk_conflict are excluded (never directional by design). */
  layerCCategories: CategoryEvidence[];
  /** True when Layer C forced a stricter-than-default Layer B bar (e.g. extreme volatility requiring 3-of-3) — caps strength at Medium regardless of how clean everything else looks, since the thesis only just cleared a raised bar. */
  tighteningApplied: boolean;
}

/**
 * Computed only once a VALID thesis already exists (see decisionFlow.ts) —
 * there is no code path where this runs before the hard gates pass, so it
 * can never rescue a thesis that failed one. Risk is a separate, independent
 * axis (see the evidence-hierarchy spec §7) and is not an input here.
 *
 * Note: Risk itself isn't computable yet (stop-width/target-distance factors
 * depend on trade planning — Phase 4), so the spec's "Medium requires Risk
 * Low/Medium" qualifier is deferred: Medium is granted here whenever the
 * High/Very-high bar isn't met, and should be re-validated once Phase 4
 * makes Risk available.
 */
export function calculateSignalStrength(input: SignalStrengthInput): SignalStrength {
  const { direction, structureEvidence, layerBCategories, layerCCategories, tighteningApplied } = input;

  const allThreeAgree = layerBCategories.every((c) => leansWith(direction, c));
  const fullBias = direction === 'LONG' ? 'bullish' : 'bearish';
  const structureStrong = structureEvidence.conclusion === fullBias;

  if (!allThreeAgree || !structureStrong || tighteningApplied) return 'Medium';

  const layerCFullyPositive = layerCCategories.every((c) => leansWith(direction, c));
  return layerCFullyPositive ? 'Very high' : 'High';
}
