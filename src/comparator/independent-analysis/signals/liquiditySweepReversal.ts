import type { OhlcCloseLike, StructureEvent } from '../structure/bosChoch';
import { calculateBosChoch } from '../structure/bosChoch';
import { calculateSwingHighsLows, type SwingPoint } from '../structure/swingHighsLows';
import { calculateLiquidityZones, type LiquidityZone } from '../liquidity/liquiditySweeps';

/**
 * THIS FILE IS OUR OWN ASSEMBLY, not part of the ported smart-money-concepts
 * primitives — see metadata/provenance.ts's ownAssemblyDisclaimer. It
 * implements the standard, widely-documented SMC/ICT "liquidity sweep, then
 * structural reclaim" pattern: price sweeps a cluster of equal highs/lows,
 * then a BOS or CHOCH in the opposite direction confirms a reversal.
 */
export interface LiquiditySweepCandle extends OhlcCloseLike {}

export interface SmcReversalSignal {
  direction: 'LONG' | 'SHORT';
  sweepZone: LiquidityZone;
  confirmingEvent: StructureEvent;
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  targetReason: string;
}

/** Our own choice, not upstream's: only treat a confirming structure break as "live" if it happened within this many trailing candles. */
export const CONFIRMATION_RECENCY_WINDOW = 3;
/** Our own choice of lookback for swing detection on 1h candles — distinct from smart-money-concepts' own default of 50, which is a caller-supplied parameter, not part of the algorithm itself. */
export const DEFAULT_SWING_LENGTH = 5;

export function detectLiquiditySweepReversal(candles: LiquiditySweepCandle[], swingLength = DEFAULT_SWING_LENGTH): SmcReversalSignal | null {
  const swings: SwingPoint[] = calculateSwingHighsLows(candles, swingLength);
  if (swings.length < 4) return null;

  const zones = calculateLiquidityZones(candles, swings);
  const events = calculateBosChoch(candles, swings);
  if (events.length === 0) return null;

  const lastIndex = candles.length - 1;
  const recentEvents = events.filter((e) => e.brokenIndex >= lastIndex - CONFIRMATION_RECENCY_WINDOW);
  if (recentEvents.length === 0) return null;
  const confirmingEvent = recentEvents.reduce((a, b) => (a.brokenIndex > b.brokenIndex ? a : b));

  const direction: 'LONG' | 'SHORT' = confirmingEvent.direction === 'bullish' ? 'LONG' : 'SHORT';
  const sweepType: LiquidityZone['type'] = direction === 'LONG' ? 'low' : 'high';

  const candidateSweeps = zones.filter((z) => z.type === sweepType && z.sweptIndex !== null && z.sweptIndex <= confirmingEvent.originIndex);
  if (candidateSweeps.length === 0) return null;
  const sweepZone = candidateSweeps.reduce((a, b) => (a.sweptIndex! > b.sweptIndex! ? a : b));

  const entryPrice = candles[lastIndex].close;
  const sweepCandle = candles[sweepZone.sweptIndex!];
  const stopPrice = direction === 'LONG' ? sweepCandle.low : sweepCandle.high;

  const targetType: LiquidityZone['type'] = direction === 'LONG' ? 'high' : 'low';
  const opposingZones = zones.filter(
    (z) => z.type === targetType && z.sweptIndex === null && (direction === 'LONG' ? z.level > entryPrice : z.level < entryPrice),
  );

  let targetPrice: number;
  let targetReason: string;
  if (opposingZones.length > 0) {
    const nearest = opposingZones.reduce((a, b) => (Math.abs(a.level - entryPrice) < Math.abs(b.level - entryPrice) ? a : b));
    targetPrice = nearest.level;
    targetReason = 'Dichtstbijzijnde nog niet geraakte tegengestelde liquidity zone (equal highs/lows).';
  } else {
    const structuralCandidates = swings.filter((p) => p.type === targetType && (direction === 'LONG' ? p.level > entryPrice : p.level < entryPrice));
    if (structuralCandidates.length === 0) return null;
    const nearest = structuralCandidates.reduce((a, b) => (Math.abs(a.level - entryPrice) < Math.abs(b.level - entryPrice) ? a : b));
    targetPrice = nearest.level;
    targetReason = 'Geen open liquidity-doel beschikbaar — eerstvolgende structurele swing in de handelsrichting gebruikt als fallback-doel.';
  }

  if (direction === 'LONG' && (stopPrice >= entryPrice || targetPrice <= entryPrice)) return null;
  if (direction === 'SHORT' && (stopPrice <= entryPrice || targetPrice >= entryPrice)) return null;

  return { direction, sweepZone, confirmingEvent, entryPrice, stopPrice, targetPrice, targetReason };
}
