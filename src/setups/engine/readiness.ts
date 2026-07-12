import type { SetupCondition } from './types';

export type FamilyReadiness = 'none' | 'candidate' | 'waiting_for_confirmation' | 'active_ready';

/**
 * Shared readiness rule used by every setup family:
 * - context conditions must ALL hold, or there is no setup at all;
 * - if confirmation conditions also all hold, the setup is ready to activate;
 * - otherwise, if price is already near the trigger, it's waiting for the
 *   confirmation candle to close; if not, it's a plain candidate.
 */
export function deriveReadiness(
  contextConditions: SetupCondition[],
  confirmationConditions: SetupCondition[],
  priceNearTrigger: boolean,
): FamilyReadiness {
  if (!contextConditions.every((c) => c.met)) return 'none';
  if (confirmationConditions.every((c) => c.met)) return 'active_ready';
  return priceNearTrigger ? 'waiting_for_confirmation' : 'candidate';
}
