import type { VolatilityClassification } from '../../analysis/engine/types';
import { SETUP_RULES } from '../engine/rules';
import type { SetupDirection, SetupTarget, SetupTargetCandidate } from '../engine/types';

/**
 * Staged-exit portions (% of position to close at each target), summing to
 * 100. Deliberately not a single fixed split — it's keyed by the number of
 * defensible targets a family actually produced and by 1H volatility:
 * choppier markets front-load more into the earlier target(s) (lock in gains
 * sooner, less trust that price reaches the far target); calmer/trending
 * markets back-load more into the final "runner" target.
 */
export function allocateTargetPortions(targetCount: number, volatility: VolatilityClassification): number[] {
  if (targetCount <= 0) return [];
  if (targetCount === 1) return [...SETUP_RULES.targetPortions.single];

  const bucket: 'normal' | 'elevated' | 'extreme' =
    volatility === 'extreme' ? 'extreme' : volatility === 'elevated' ? 'elevated' : 'normal';

  if (targetCount === 2) return [...SETUP_RULES.targetPortions.two[bucket]];

  // 3 or more defensible targets: use the documented 3-target split for the
  // first two, then spread any additional targets evenly across the rest of
  // the final allocation so the total still sums to exactly 100.
  const [first, second, remainder] = SETUP_RULES.targetPortions.three[bucket];
  if (targetCount === 3) return [first, second, remainder];

  const extraCount = targetCount - 2;
  const share = Math.floor(remainder / extraCount);
  const shares = Array.from({ length: extraCount }, () => share);
  shares[shares.length - 1] += remainder - share * extraCount; // fold rounding remainder into the last (final) target
  return [first, second, ...shares];
}

/**
 * Orders a family's raw target candidates nearest-first, assigns staged-exit
 * portions (summing to 100), and marks the furthest one as the final/runner
 * target. This is the single place every family's targets pass through, so
 * the staged-exit rule is applied uniformly.
 */
export function finalizeTargets(
  rawTargets: SetupTargetCandidate[],
  direction: SetupDirection,
  volatility: VolatilityClassification,
): SetupTarget[] {
  if (rawTargets.length === 0) return [];
  const sorted = [...rawTargets].sort((a, b) => (direction === 'LONG' ? a.price - b.price : b.price - a.price));
  const portions = allocateTargetPortions(sorted.length, volatility);
  return sorted.map((target, index) => ({
    ...target,
    order: index + 1,
    positionPortionPct: portions[index] ?? 0,
    isFinal: index === sorted.length - 1,
    status: 'pending',
  }));
}
