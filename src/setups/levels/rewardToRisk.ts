import type { SetupDirection } from '../engine/types';

/** Reward:risk ratio for a directional trade between an entry, target and invalidation level. */
export function calculateRewardToRisk(
  entry: number,
  target: number,
  invalidation: number,
  direction: SetupDirection,
): number | null {
  const risk = direction === 'LONG' ? entry - invalidation : invalidation - entry;
  const reward = direction === 'LONG' ? target - entry : entry - target;
  if (risk <= 0 || reward <= 0) return null;
  return reward / risk;
}
