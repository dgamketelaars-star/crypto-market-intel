import { STALE_AFTER_MS, isStale } from '../utils/freshness';
import { useNow } from './useNow';

export function useIsStale(updatedAt: number | undefined, thresholdMs = STALE_AFTER_MS): boolean {
  const now = useNow(5_000);
  return isStale(updatedAt, now, thresholdMs);
}
