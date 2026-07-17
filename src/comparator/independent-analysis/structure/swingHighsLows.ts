/**
 * Swing highs/lows, reimplemented from the documented behaviour of
 * smart-money-concepts' `swing_highs_lows()` (see metadata/provenance.ts):
 * "A swing high is when the current high is the highest high out of the
 * swing_length amount of candles before and after. A swing low is the
 * mirror on lows." A swing point is only confirmed `swingLength` candles
 * AFTER it prints — this is an inherent property of centred swing
 * detection, not a bug, and must be respected by callers (a point at index
 * i is not knowable until index i + swingLength has closed).
 */
export interface SwingCandle {
  high: number;
  low: number;
}

export type SwingType = 'high' | 'low';

export interface SwingPoint {
  index: number;
  type: SwingType;
  level: number;
}

function isCenteredExtreme(candles: SwingCandle[], i: number, swingLength: number, field: 'high' | 'low', mode: 'max' | 'min'): boolean {
  const from = i - swingLength;
  const to = i + swingLength;
  const value = candles[i][field];
  for (let j = from; j <= to; j++) {
    if (j === i) continue;
    const other = candles[j][field];
    if (mode === 'max' && other > value) return false;
    if (mode === 'min' && other < value) return false;
  }
  return true;
}

/**
 * Raw centred-extreme detection, before the alternation cleanup below.
 * A candle can only be evaluated once `swingLength` candles exist on both
 * sides of it.
 */
function detectRawSwings(candles: SwingCandle[], swingLength: number): (SwingType | null)[] {
  const n = candles.length;
  const raw: (SwingType | null)[] = new Array(n).fill(null);
  for (let i = swingLength; i < n - swingLength; i++) {
    if (isCenteredExtreme(candles, i, swingLength, 'high', 'max')) raw[i] = 'high';
    else if (isCenteredExtreme(candles, i, swingLength, 'low', 'min')) raw[i] = 'low';
  }
  return raw;
}

export function calculateSwingHighsLows(candles: SwingCandle[], swingLength = 50): SwingPoint[] {
  const n = candles.length;
  if (n < swingLength * 2 + 1) return [];

  const raw = detectRawSwings(candles, swingLength);
  let points: SwingPoint[] = [];
  for (let i = 0; i < n; i++) {
    const type = raw[i];
    if (!type) continue;
    points.push({ index: i, type, level: type === 'high' ? candles[i].high : candles[i].low });
  }

  // Consecutive same-type swings collapse to the single most extreme one —
  // keeps the sequence strictly alternating, which BOS/CHOCH detection relies on.
  let changed = true;
  while (changed) {
    changed = false;
    const next: SwingPoint[] = [];
    for (let i = 0; i < points.length; i++) {
      const current = points[i];
      const prevKept = next[next.length - 1];
      if (prevKept && prevKept.type === current.type) {
        const currentIsMoreExtreme = current.type === 'high' ? current.level >= prevKept.level : current.level <= prevKept.level;
        if (currentIsMoreExtreme) next[next.length - 1] = current;
        changed = true;
      } else {
        next.push(current);
      }
    }
    points = next;
  }

  // Bookend the sequence with an opposite-type anchor at index 0 and n-1 so a
  // 4-point BOS/CHOCH sequence is always well-defined near the edges of the window.
  if (points.length > 0) {
    const first = points[0];
    const bookendFirstType: SwingType = first.type === 'high' ? 'low' : 'high';
    if (first.index !== 0) {
      points = [{ index: 0, type: bookendFirstType, level: bookendFirstType === 'high' ? candles[0].high : candles[0].low }, ...points];
    }
    const last = points[points.length - 1];
    const bookendLastType: SwingType = last.type === 'low' ? 'high' : 'low';
    if (last.index !== n - 1) {
      points = [...points, { index: n - 1, type: bookendLastType, level: bookendLastType === 'high' ? candles[n - 1].high : candles[n - 1].low }];
    }
  }

  return points;
}
