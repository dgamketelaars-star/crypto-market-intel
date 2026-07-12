/** A live value is considered stale once it hasn't updated within this window. */
export const STALE_AFTER_MS = 20_000;

/** Connection is considered fully offline once nothing has come through for this long. */
export const OFFLINE_AFTER_MS = 60_000;

export function isStale(updatedAt: number | undefined, now: number, thresholdMs = STALE_AFTER_MS): boolean {
  if (!updatedAt) return true;
  return now - updatedAt > thresholdMs;
}

export type FreshnessLevel = 'live' | 'delayed' | 'stale';

/** Three-state freshness read for a single data point (e.g. one symbol's live price) — used where "delayed" needs to be distinguished from fully "stale", not just a live/not-live boolean. */
export function classifyFreshness(updatedAt: number | undefined, now: number): FreshnessLevel {
  if (!updatedAt) return 'stale';
  const age = now - updatedAt;
  if (age <= STALE_AFTER_MS) return 'live';
  if (age <= OFFLINE_AFTER_MS) return 'delayed';
  return 'stale';
}
