import { SETUP_RULES } from '../engine/rules';
import type { SetupDirection } from '../engine/types';

/** True once price is already further from the trigger than the ATR-based allowed entry distance — "do not chase". */
export function isEntryMissed(direction: SetupDirection, triggerPrice: number, firstLivePrice: number, atr: number): boolean {
  if (atr <= 0) return false;
  const maxDistance = atr * SETUP_RULES.atr.maxMissedEntryAtrMult;
  const distance = direction === 'LONG' ? firstLivePrice - triggerPrice : triggerPrice - firstLivePrice;
  // Only "missed" if price ran further in the *favourable* direction beyond the allowed window —
  // being on the wrong side of the trigger is an invalidation concern, not a missed-entry one.
  return distance > maxDistance;
}

export function updateExcursions(
  direction: SetupDirection,
  currentFavorable: number,
  currentAdverse: number,
  price: number,
): { favorable: number; adverse: number } {
  const isLong = direction === 'LONG';
  return {
    favorable: isLong ? Math.max(currentFavorable, price) : Math.min(currentFavorable, price),
    adverse: isLong ? Math.min(currentAdverse, price) : Math.max(currentAdverse, price),
  };
}

export interface EntryDistance {
  /** Raw % change from entry to current price — sign matches price direction, not favourability. */
  pct: number;
  favorable: boolean;
}

/** Correct LONG/SHORT maths: for a SHORT, a price *drop* is favourable and shows as a negative %. */
export function calculateEntryDistance(direction: SetupDirection, entryPrice: number, currentPrice: number): EntryDistance {
  if (entryPrice === 0) return { pct: 0, favorable: false };
  const pct = ((currentPrice - entryPrice) / entryPrice) * 100;
  const favorable = direction === 'LONG' ? pct >= 0 : pct <= 0;
  return { pct, favorable };
}
