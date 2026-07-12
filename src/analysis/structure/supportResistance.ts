import type { Candle } from '../../services/binance/types';
import type { SupportResistanceZone, SwingPattern } from '../engine/types';
import { RULES } from '../engine/rules';

export interface SwingPoint {
  index: number;
  price: number;
}

/**
 * A candle is a swing high/low when its high/low is the most extreme within
 * a small window on both sides (a simple, explainable "fractal" pivot).
 */
export function findSwingPoints(candles: Candle[], lookback = RULES.structure.swingLookback): {
  highs: SwingPoint[];
  lows: SwingPoint[];
} {
  const highs: SwingPoint[] = [];
  const lows: SwingPoint[] = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    const window = candles.slice(i - lookback, i + lookback + 1);
    const windowHighs = window.map((c) => c.high);
    const windowLows = window.map((c) => c.low);
    if (candles[i].high === Math.max(...windowHighs)) highs.push({ index: i, price: candles[i].high });
    if (candles[i].low === Math.min(...windowLows)) lows.push({ index: i, price: candles[i].low });
  }
  return { highs, lows };
}

export function classifySwingPattern(candles: Candle[]): SwingPattern {
  const { highs, lows } = findSwingPoints(candles);
  if (highs.length < 2 || lows.length < 2) return 'insufficient_data';

  const [prevHigh, lastHigh] = highs.slice(-2);
  const [prevLow, lastLow] = lows.slice(-2);
  const higherHighs = lastHigh.price > prevHigh.price;
  const higherLows = lastLow.price > prevLow.price;
  const lowerHighs = lastHigh.price < prevHigh.price;
  const lowerLows = lastLow.price < prevLow.price;

  if (higherHighs && higherLows) return 'higher_highs_higher_lows';
  if (lowerHighs && lowerLows) return 'lower_highs_lower_lows';
  return 'mixed';
}

function clusterIntoZones(points: SwingPoint[], type: 'support' | 'resistance', currentPrice: number): SupportResistanceZone[] {
  if (points.length === 0) return [];
  const tolerance = RULES.structure.zoneTouchToleragePct / 100;
  const sorted = [...points].sort((a, b) => a.price - b.price);

  const zones: { prices: number[]; touches: number }[] = [];
  for (const point of sorted) {
    const last = zones[zones.length - 1];
    if (last && Math.abs(point.price - avg(last.prices)) / avg(last.prices) <= tolerance) {
      last.prices.push(point.price);
      last.touches += 1;
    } else {
      zones.push({ prices: [point.price], touches: 1 });
    }
  }

  return zones.map((zone) => {
    const price = avg(zone.prices);
    return {
      type,
      price,
      touches: zone.touches,
      distancePct: ((price - currentPrice) / currentPrice) * 100,
    };
  });
}

function avg(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function findSupportResistanceZones(
  candles: Candle[],
  currentPrice: number,
): { supports: SupportResistanceZone[]; resistances: SupportResistanceZone[] } {
  const { highs, lows } = findSwingPoints(candles);
  const resistanceCandidates = highs.filter((h) => h.price >= currentPrice);
  const supportCandidates = lows.filter((l) => l.price <= currentPrice);

  const resistances = clusterIntoZones(resistanceCandidates, 'resistance', currentPrice).sort(
    (a, b) => a.distancePct - b.distancePct,
  );
  const supports = clusterIntoZones(supportCandidates, 'support', currentPrice).sort(
    (a, b) => Math.abs(a.distancePct) - Math.abs(b.distancePct),
  );

  return { supports, resistances };
}
