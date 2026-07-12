import type { SetupEvidence, SetupStrength } from '../engine/types';

/**
 * Signal strength answers "how many independent layers agree?" — counted by
 * distinct evidence *groups*, not raw evidence count, so closely related
 * indicators (e.g. RSI + MACD, both "momentum") never get double-counted.
 *
 * net = supporting groups − opposing groups
 *   <=1 -> Low, 2 -> Medium, 3 -> High, >=4 -> Very high
 */
export function calculateSignalStrength(supporting: SetupEvidence[], opposing: SetupEvidence[]): SetupStrength {
  const supportGroups = new Set(supporting.map((e) => e.group));
  const opposeGroups = new Set(opposing.map((e) => e.group));
  const net = supportGroups.size - opposeGroups.size;

  if (net >= 4) return 'Very high';
  if (net === 3) return 'High';
  if (net === 2) return 'Medium';
  return 'Low';
}

const STRENGTH_ORDER: SetupStrength[] = ['Low', 'Medium', 'High', 'Very high'];

/** Used by the market-context gate to soften strength by one tier without inventing a new scale. */
export function downgradeStrength(strength: SetupStrength, tiers = 1): SetupStrength {
  const index = Math.max(0, STRENGTH_ORDER.indexOf(strength) - tiers);
  return STRENGTH_ORDER[index];
}
