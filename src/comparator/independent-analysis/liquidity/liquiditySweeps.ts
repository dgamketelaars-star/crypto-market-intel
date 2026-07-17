import type { SwingPoint } from '../structure/swingHighsLows';

/**
 * Equal-highs / equal-lows liquidity clustering and sweep detection,
 * reimplemented from smart-money-concepts' `liquidity()` (see
 * metadata/provenance.ts). Clusters swing points of the same type that sit
 * within `rangePercent` of the overall candle range of each other, then
 * records the candle index (if any) where price later traded through that
 * cluster. NOTE: this only flags that the level was reached — it does NOT
 * by itself confirm a reversal (no close-back-inside check). That
 * confirmation is a deliberate addition made in signals/liquiditySweepReversal.ts,
 * not part of the faithfully-ported primitive.
 */
export interface LiquidityOhlc {
  high: number;
  low: number;
}

export interface LiquidityZone {
  /** 'high' = clustered equal highs (bearish liquidity resting above price); 'low' = clustered equal lows (bullish liquidity resting below price). */
  type: 'high' | 'low';
  level: number;
  /** Index of the earliest swing point in the cluster. */
  startIndex: number;
  /** Index of the latest swing point grouped into the cluster. */
  endIndex: number;
  /** Candle index where price first traded through the cluster's range, or null if never (yet) swept. */
  sweptIndex: number | null;
}

export function calculateLiquidityZones(candles: LiquidityOhlc[], swings: SwingPoint[], rangePercent = 0.01): LiquidityZone[] {
  if (candles.length === 0 || swings.length === 0) return [];

  const overallHigh = Math.max(...candles.map((c) => c.high));
  const overallLow = Math.min(...candles.map((c) => c.low));
  const pipRange = (overallHigh - overallLow) * rangePercent;

  const zones: LiquidityZone[] = [];
  const used = new Set<number>();

  for (const type of ['high', 'low'] as const) {
    const candidates = swings.filter((p) => p.type === type);

    for (let a = 0; a < candidates.length; a++) {
      const anchor = candidates[a];
      if (used.has(anchor.index)) continue;

      const rangeLow = anchor.level - pipRange;
      const rangeHigh = anchor.level + pipRange;

      let sweptIndex: number | null = null;
      for (let i = anchor.index + 1; i < candles.length; i++) {
        const swept = type === 'high' ? candles[i].high >= rangeHigh : candles[i].low <= rangeLow;
        if (swept) {
          sweptIndex = i;
          break;
        }
      }

      const group: SwingPoint[] = [anchor];
      for (let b = a + 1; b < candidates.length; b++) {
        const candidate = candidates[b];
        if (sweptIndex !== null && candidate.index >= sweptIndex) break;
        if (candidate.level >= rangeLow && candidate.level <= rangeHigh) {
          group.push(candidate);
          used.add(candidate.index);
        }
      }

      if (group.length > 1) {
        const avgLevel = group.reduce((sum, p) => sum + p.level, 0) / group.length;
        zones.push({
          type,
          level: avgLevel,
          startIndex: anchor.index,
          endIndex: group[group.length - 1].index,
          sweptIndex,
        });
      }
    }
  }

  return zones.sort((a, b) => a.startIndex - b.startIndex);
}
