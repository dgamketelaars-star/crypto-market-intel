/**
 * Phase 5: setup generation is live again, now driven entirely by the
 * intelligence/evidence pipeline (src/intelligence/orchestrateSymbol.ts) —
 * the old family-pattern engine (src/setups/families/, qualityGate.ts,
 * tradeHorizon.ts, conflictResolution.ts, marketContextGate.ts) is no
 * longer wired into setupStore and is unused dead code, kept only as
 * reference pending an explicit decision to remove it.
 */
export const SETUP_GENERATION_ENABLED = true;

export const SETUP_GENERATION_PAUSED_MESSAGE =
  'Setup-engine wordt opnieuw gekalibreerd. Marktdata en scanner blijven actief.';
