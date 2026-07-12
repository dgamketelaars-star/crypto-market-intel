export interface LayerABiasResult {
  bias: 'bullish' | 'bearish' | 'neutral';
  conflicted: boolean;
}

/**
 * Step 2 of the decision flow: establish ONE directional bias from regime +
 * higher-timeframe structure. Structure is the tie-break priority when both
 * are non-neutral and agree, or when only one is non-neutral — it is the
 * literal foundation (see the evidence-hierarchy spec). If both are
 * non-neutral and *disagree*, that is a Layer A conflict, not a tie-break.
 * Shared by the Phase 2 evidence orchestrator (to seed risk/conflict
 * evaluation) and the Phase 3 decision flow, so both stay consistent by
 * construction.
 */
export function deriveLayerABias(
  structureBias: 'bullish' | 'bearish' | 'neutral',
  regimeBias: 'bullish' | 'bearish' | 'neutral',
): LayerABiasResult {
  if (structureBias !== 'neutral' && regimeBias !== 'neutral' && structureBias !== regimeBias) {
    return { bias: 'neutral', conflicted: true };
  }
  const resolved = structureBias !== 'neutral' ? structureBias : regimeBias;
  return { bias: resolved, conflicted: false };
}
