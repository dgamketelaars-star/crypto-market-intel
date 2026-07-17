import type { TripleConfirmationPoint } from '../signals/tripleConfirmation';

export type EntrySignal = 'LONG' | 'SHORT' | null;

/** Upstream `populate_entry_trend`: enter_long / enter_short columns, mirrored here. */
export function detectEntry(point: TripleConfirmationPoint): EntrySignal {
  if (point.enterLong) return 'LONG';
  if (point.enterShort) return 'SHORT';
  return null;
}
