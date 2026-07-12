import type { SetupDirection } from '../engine/types';

/** Moves a reference price a given number of ATR away from the trade, in the adverse direction. */
export function applyAtrBuffer(referencePrice: number, atr: number, multiplier: number, direction: SetupDirection): number {
  const offset = atr * multiplier;
  return direction === 'LONG' ? referencePrice - offset : referencePrice + offset;
}

/** True when price is within `multiplier` ATR of the level — used to decide "near trigger" vs "still a candidate". */
export function isWithinAtr(price: number, level: number, atr: number, multiplier: number): boolean {
  if (atr <= 0) return false;
  return Math.abs(price - level) <= atr * multiplier;
}
