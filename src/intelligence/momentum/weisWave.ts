import type { Candle } from '../../services/binance/types';
import { findSwingPoints, type SwingPoint } from '../../analysis/structure/supportResistance';

export interface WaveSegment {
  fromIndex: number;
  toIndex: number;
  fromPrice: number;
  toPrice: number;
  direction: 'up' | 'down';
  /** Total candle volume between the two pivots — the wave's "effort". */
  cumulativeVolume: number;
}

export type EffortVsResult = 'strengthening' | 'weakening' | 'neutral' | 'insufficient_data';

export interface WeisWaveResult {
  waves: WaveSegment[];
  /** How the latest wave's price-progress-per-unit-volume compares to the last wave of the same direction — the classic Weis "effort vs. result" read. */
  latestWaveEffortVsResult: EffortVsResult;
}

const EFFICIENCY_CHANGE_THRESHOLD = 0.15;

interface TaggedPivot extends SwingPoint {
  type: 'high' | 'low';
}

/**
 * `findSwingPoints` returns highs and lows independently, so two pivots of
 * the same type can appear back-to-back (a shallow dip between two highs
 * that never became a low itself). A wave needs a clean alternating
 * high/low/high/... path, so consecutive same-type pivots are collapsed to
 * whichever is more extreme.
 */
function mergeIntoAlternatingPivots(highs: SwingPoint[], lows: SwingPoint[]): TaggedPivot[] {
  const combined: TaggedPivot[] = [...highs.map((p) => ({ ...p, type: 'high' as const })), ...lows.map((p) => ({ ...p, type: 'low' as const }))].sort((a, b) => a.index - b.index);

  const result: TaggedPivot[] = [];
  for (const point of combined) {
    const last = result[result.length - 1];
    if (!last) {
      result.push(point);
      continue;
    }
    if (last.type !== point.type) {
      result.push(point);
    } else if ((point.type === 'high' && point.price > last.price) || (point.type === 'low' && point.price < last.price)) {
      result[result.length - 1] = point;
    }
  }
  return result;
}

function buildWaveSegments(pivots: TaggedPivot[], candles: Candle[]): WaveSegment[] {
  const waves: WaveSegment[] = [];
  for (let i = 1; i < pivots.length; i++) {
    const from = pivots[i - 1];
    const to = pivots[i];
    const cumulativeVolume = candles.slice(from.index, to.index + 1).reduce((sum, c) => sum + c.volume, 0);
    waves.push({
      fromIndex: from.index,
      toIndex: to.index,
      fromPrice: from.price,
      toPrice: to.price,
      direction: to.price >= from.price ? 'up' : 'down',
      cumulativeVolume,
    });
  }
  return waves;
}

function classifyEffortVsResult(waves: WaveSegment[]): EffortVsResult {
  if (waves.length === 0) return 'insufficient_data';
  const latest = waves[waves.length - 1];
  const previousSameDirection = [...waves.slice(0, -1)].reverse().find((w) => w.direction === latest.direction);
  if (!previousSameDirection) return 'insufficient_data';
  if (latest.cumulativeVolume <= 0 || previousSameDirection.cumulativeVolume <= 0) return 'insufficient_data';

  const latestEfficiency = Math.abs(latest.toPrice - latest.fromPrice) / latest.cumulativeVolume;
  const prevEfficiency = Math.abs(previousSameDirection.toPrice - previousSameDirection.fromPrice) / previousSameDirection.cumulativeVolume;
  if (prevEfficiency <= 0) return 'insufficient_data';

  const ratio = latestEfficiency / prevEfficiency;
  if (ratio >= 1 + EFFICIENCY_CHANGE_THRESHOLD) return 'strengthening';
  if (ratio <= 1 - EFFICIENCY_CHANGE_THRESHOLD) return 'weakening';
  return 'neutral';
}

/**
 * David Weis's wave analysis: cumulative volume between consecutive swing
 * pivots is one "wave" (an up-leg or down-leg). Comparing the latest wave's
 * price-progress-per-unit-volume ("efficiency") against the last wave of
 * the same direction is a genuine effort-vs-result read — a new high made
 * on markedly less volume-per-point-of-progress than the prior up-wave is a
 * quantified weakening signal, richer than an RSI/MACD divergence check
 * alone because it's grounded in actual traded volume, not an oscillator.
 */
export function calculateWeisWaves(candles: Candle[]): WeisWaveResult {
  const { highs, lows } = findSwingPoints(candles);
  const pivots = mergeIntoAlternatingPivots(highs, lows);
  const waves = buildWaveSegments(pivots, candles);
  return { waves, latestWaveEffortVsResult: classifyEffortVsResult(waves) };
}
