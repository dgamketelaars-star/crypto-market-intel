/**
 * How tightly a set of moving averages (e.g. EMA20/50/100/200) are bunched
 * together, relative to price — a small spread means the MAs have converged
 * (compression/consolidation), a large spread means they're fanned out
 * (established trend). Returns null if fewer than two MAs are available or
 * price is zero.
 */
export function calculateMaCompressionPct(maValues: (number | null)[], price: number): number | null {
  const values = maValues.filter((v): v is number => v !== null);
  if (values.length < 2 || price === 0) return null;
  const spread = Math.max(...values) - Math.min(...values);
  return spread / price;
}
