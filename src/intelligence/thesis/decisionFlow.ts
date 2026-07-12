import type { EvidenceSynthesisResult } from '../evidence/synthesize';
import { buildThesisNarrative } from '../explanations/buildNarrative';
import { calculateSignalStrength } from './signalStrength';
import { leansWith, stronglyOpposes, type NoThesisReason, type ThesisDirection, type ThesisRejection, type ThesisResult } from './types';

function reject(reason: NoThesisReason, detail: string, evaluated: ThesisDirection[]): ThesisRejection {
  return { outcome: 'NO_THESIS', reason, detail, evaluated };
}

/**
 * The exact 7-step decision flow from the Evidence Synthesis & Decision
 * Hierarchy spec. Every step is an independent boolean check with a single
 * tie-break rule (step 2's structure-priority) — never a weighted sum.
 * Step 5 ("resolve all opposing evidence") is implemented by the
 * risk_conflict evidence category itself, which was built specifically to
 * serve as this circuit breaker (see evaluateRiskConflict) — so it is
 * checked directly here rather than duplicated as separate logic.
 * Step 7 (trade planning) is intentionally not invoked here — this
 * function only ever returns a thesis, never entry/stop/target levels
 * (Phase 4).
 */
export function decideThesis(symbol: string, synthesis: EvidenceSynthesisResult): ThesisResult {
  const { layers, regime, provisionalBias, layerAConflicted, volatilityExtreme } = synthesis;

  // STEP 1 — validate Layer A hard gates
  if (layers.layerA.marketRegime.gateStatus === 'blocked') {
    return reject('regime_unusable', layers.layerA.marketRegime.blockedReason ?? 'Market regime is unusable.', []);
  }
  if (layers.layerA.higherTimeframeStructure.gateStatus === 'blocked') {
    return reject('htf_structure_unclear', layers.layerA.higherTimeframeStructure.blockedReason ?? 'Higher-timeframe structure is unclear.', []);
  }

  // STEP 2 — establish ONE directional bias from regime + HTF structure
  if (layerAConflicted) {
    return reject('layer_a_conflict', 'Market regime and higher-timeframe structure directly disagree — no single bias can be established.', []);
  }
  if (provisionalBias === 'neutral') {
    return reject('no_directional_foundation', 'Regime and higher-timeframe structure are both neutral — no directional foundation to build a thesis on.', []);
  }
  const direction: ThesisDirection = provisionalBias === 'bullish' ? 'LONG' : 'SHORT';

  // STEP 2b — gate entry-location quality for this bias
  const entryLocation = layers.layerA.entryLocationQuality[direction];
  if (entryLocation.gateStatus === 'blocked') {
    return reject('no_entry_location', entryLocation.blockedReason ?? `No defensible entry location for a ${direction}.`, [direction]);
  }

  // STEP 3 — Layer B directional confirmation
  const layerBCategories = [layers.layerB.trend, layers.layerB.momentum, layers.layerB.volume];
  const insufficientCount = layerBCategories.filter((c) => c.conclusion === 'insufficient_data').length;
  if (insufficientCount >= 2) {
    return reject('insufficient_layer_b_confirmation', 'Two or more of trend/momentum/volume have insufficient data — Layer B confirmation cannot be established.', [direction]);
  }
  if (layerBCategories.some((c) => stronglyOpposes(direction, c))) {
    return reject('layer_b_strong_contradiction', `A Layer B category strongly opposes the ${direction} bias.`, [direction]);
  }
  const agreeCount = layerBCategories.filter((c) => leansWith(direction, c)).length;
  if (agreeCount < 2) {
    return reject('insufficient_layer_b_confirmation', `Only ${agreeCount} of 3 Layer B categories (trend/momentum/volume) support the ${direction} bias — at least 2 are required.`, [direction]);
  }

  // STEP 4 — Layer C context, risk and veto
  const contextAdjustments: string[] = [];
  let tighteningApplied = false;

  if (volatilityExtreme) {
    tighteningApplied = true;
    contextAdjustments.push('Extreme volatility raised the required Layer B confirmation to 3-of-3');
    if (agreeCount < 3) {
      return reject(
        'insufficient_layer_b_confirmation',
        `Volatility is extreme, which raises the Layer B bar to 3-of-3 — only ${agreeCount} of 3 categories agreed.`,
        [direction],
      );
    }
  }

  const btcContext = layers.layerC.btcEthContext;
  if (stronglyOpposes(direction, btcContext)) {
    return reject(
      'layer_c_veto',
      `BTC/ETH market context strongly opposes a ${direction} on ${symbol}, with no exceptional relative-strength evidence to override it.`,
      [direction],
    );
  }
  if (!leansWith(direction, btcContext) && btcContext.conclusion !== 'neutral') {
    contextAdjustments.push('BTC/ETH context does not confirm this direction — treat as a weaker context read');
  }

  const derivatives = layers.layerC.derivativesPositioning;
  if (stronglyOpposes(direction, derivatives)) {
    contextAdjustments.push('Derivatives positioning leans against this direction — a risk factor, not a veto by itself');
  }

  // riskConflict is the "resolve all opposing evidence" circuit breaker — step 5 of the spec's flow.
  if (layers.layerC.riskConflict.conclusion === 'conflicted') {
    return reject('unresolved_opposing_evidence', 'Cumulative opposing evidence across categories is too high to treat this as one coherent thesis.', [direction]);
  }

  // STEP 6 — a valid thesis survives every check above
  const signalStrength = calculateSignalStrength({
    direction,
    structureEvidence: layers.layerA.higherTimeframeStructure,
    layerBCategories,
    layerCCategories: [derivatives, btcContext],
    tighteningApplied,
  });

  const narrative = buildThesisNarrative({ symbol, direction, regime, layers, signalStrength, contextAdjustments });

  return {
    outcome: direction === 'LONG' ? 'VALID_LONG_THESIS' : 'VALID_SHORT_THESIS',
    direction,
    layers,
    regime,
    contextAdjustments,
    signalStrength,
    narrative,
  };
}
