import type { SetupDirection } from '../adapters/normalisedStrategySetup';

/**
 * Upstream `minimal_roi` table, reproduced exactly including the
 * non-monotonic 75% entry at minute 30 — see metadata/strategyLimitations.ts.
 * Keys are minutes elapsed since entry; the applicable threshold is the
 * largest key <= elapsed minutes.
 */
export const ROI_TABLE: ReadonlyArray<{ afterMinutes: number; requiredRoiPct: number }> = [
  { afterMinutes: 0, requiredRoiPct: 0.1 },
  { afterMinutes: 30, requiredRoiPct: 0.75 },
  { afterMinutes: 60, requiredRoiPct: 0.05 },
  { afterMinutes: 120, requiredRoiPct: 0.025 },
];

export const TRAILING_STOP_POSITIVE = 0.05;
export const TRAILING_STOP_POSITIVE_OFFSET = 0.1;
/**
 * Upstream `trailing_only_offset_is_reached = False`. Per freqtrade's
 * documented semantics this means the 5% trail activates as soon as ANY
 * profit exists — the 10% offset above is not used to gate activation in
 * this mode. Flagged as an interpretation, not a verified freqtrade
 * backtest run, in metadata/provenance.ts.
 */
export const TRAILING_ONLY_OFFSET_IS_REACHED = false;

export function requiredRoiPctAt(elapsedMinutes: number): number {
  let applicable = ROI_TABLE[0].requiredRoiPct;
  for (const step of ROI_TABLE) {
    if (step.afterMinutes <= elapsedMinutes) applicable = step.requiredRoiPct;
  }
  return applicable;
}

export function roiTargetPrice(entryPrice: number, direction: SetupDirection, elapsedMinutes: number): number {
  const pct = requiredRoiPctAt(elapsedMinutes);
  return direction === 'LONG' ? entryPrice * (1 + pct) : entryPrice * (1 - pct);
}

/** currentUnrealizedProfitPct > 0 is upstream's activation condition given TRAILING_ONLY_OFFSET_IS_REACHED = false. */
export function isTrailingActive(currentUnrealizedProfitPct: number): boolean {
  return currentUnrealizedProfitPct > 0;
}

export function trailingStopPrice(peakFavorablePrice: number, direction: SetupDirection): number {
  return direction === 'LONG' ? peakFavorablePrice * (1 - TRAILING_STOP_POSITIVE) : peakFavorablePrice * (1 + TRAILING_STOP_POSITIVE);
}
