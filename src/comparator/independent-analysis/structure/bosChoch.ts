import type { SwingPoint } from './swingHighsLows';

/**
 * BOS (Break of Structure) / CHOCH (Change of Character), reimplemented from
 * smart-money-concepts' `bos_choch()` (see metadata/provenance.ts). Both are
 * read off the same 4-point alternating swing sequence:
 *   BOS bullish:   low1 < low2 < high1 < high2   (higher low AND higher high — continuation)
 *   CHOCH bullish: low2 < low1 < high1 < high2   (lower low but still a higher high — character change)
 *   and the bearish mirror of each.
 * An event only counts once price has actually traded back through the
 * broken level on a LATER candle (`brokenIndex`) — an unconfirmed structural
 * shift is not reported at all, matching upstream's behaviour of dropping
 * anything that never got price-confirmed.
 */
export interface OhlcCloseLike {
  close: number;
  high: number;
  low: number;
}

export type StructureEventKind = 'BOS' | 'CHOCH';
export type StructureDirection = 'bullish' | 'bearish';

export interface StructureEvent {
  kind: StructureEventKind;
  direction: StructureDirection;
  /** Index of the swing pivot that marks the event (the most recent pivot before the break). */
  originIndex: number;
  /** The structural level that had to be broken to confirm this event. */
  level: number;
  /** Candle index where price closed (or wicked, if closeBreak=false) through `level`. */
  brokenIndex: number;
}

interface Candidate {
  kind: StructureEventKind;
  direction: StructureDirection;
  originIndex: number;
  level: number;
}

function classifyWindow(p1: SwingPoint, p2: SwingPoint, p3: SwingPoint, p4: SwingPoint): Candidate | null {
  if (p1.type === 'low' && p2.type === 'high' && p3.type === 'low' && p4.type === 'high') {
    if (p1.level < p3.level && p3.level < p2.level && p2.level < p4.level) {
      return { kind: 'BOS', direction: 'bullish', originIndex: p3.index, level: p2.level };
    }
    if (p4.level > p2.level && p2.level > p1.level && p1.level > p3.level) {
      return { kind: 'CHOCH', direction: 'bullish', originIndex: p3.index, level: p2.level };
    }
  }
  if (p1.type === 'high' && p2.type === 'low' && p3.type === 'high' && p4.type === 'low') {
    if (p1.level > p3.level && p3.level > p2.level && p2.level > p4.level) {
      return { kind: 'BOS', direction: 'bearish', originIndex: p3.index, level: p2.level };
    }
    if (p4.level < p2.level && p2.level < p1.level && p1.level < p3.level) {
      return { kind: 'CHOCH', direction: 'bearish', originIndex: p3.index, level: p2.level };
    }
  }
  return null;
}

function findBrokenIndex(candles: OhlcCloseLike[], candidate: Candidate, closeBreak: boolean): number | null {
  const start = candidate.originIndex + 2;
  for (let i = start; i < candles.length; i++) {
    const price = candidate.direction === 'bullish' ? (closeBreak ? candles[i].close : candles[i].high) : closeBreak ? candles[i].close : candles[i].low;
    const crossed = candidate.direction === 'bullish' ? price > candidate.level : price < candidate.level;
    if (crossed) return i;
  }
  return null;
}

export function calculateBosChoch(candles: OhlcCloseLike[], swings: SwingPoint[], closeBreak = true): StructureEvent[] {
  const candidates: (Candidate & { brokenIndex: number | null })[] = [];

  for (let k = 3; k < swings.length; k++) {
    const window = classifyWindow(swings[k - 3], swings[k - 2], swings[k - 1], swings[k]);
    if (window) candidates.push({ ...window, brokenIndex: findBrokenIndex(candles, window, closeBreak) });
  }

  // An older unresolved candidate that would only confirm AFTER a newer
  // candidate already confirmed is superseded — matches upstream's cleanup.
  for (const candidate of candidates) {
    if (candidate.brokenIndex === null) continue;
    for (const other of candidates) {
      if (other.originIndex < candidate.originIndex && other.brokenIndex !== null && other.brokenIndex >= candidate.brokenIndex) {
        other.brokenIndex = null;
      }
    }
  }

  return candidates
    .filter((c): c is Candidate & { brokenIndex: number } => c.brokenIndex !== null)
    .map((c) => ({ kind: c.kind, direction: c.direction, originIndex: c.originIndex, level: c.level, brokenIndex: c.brokenIndex }));
}
