/** Simple relative-performance read: base 24h% change minus benchmark 24h% change. */
export function calculateRelativeStrengthPct(baseChangePct: number | null, benchmarkChangePct: number | null): number | null {
  if (baseChangePct === null || benchmarkChangePct === null) return null;
  return baseChangePct - benchmarkChangePct;
}
