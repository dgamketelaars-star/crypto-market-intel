import type { Candle } from '../../services/binance/types';
import { findSupportResistanceZones } from '../../analysis/structure/supportResistance';
import { blockedGate, fact, layerAGate } from '../evidence/build';
import type { LayerACategoryEvidence } from '../evidence/types';
import { INTEL_RULES } from '../rules';
import type { ThesisDirection } from '../thesis/types';
import { detectRetest } from './structureEvents';

export type { ThesisDirection };

export interface DefensibleZone {
  price: number;
  touches: number;
  source: 'zone' | 'retest';
}

/**
 * The single place that answers "where, exactly, is the nearest defensible
 * zone for this direction" — shared by the Layer A gate below (which only
 * needs to know whether one exists) and Phase 4 trade-planning (which needs
 * the actual price to build the entry zone/stop/targets from). Keeping this
 * in one place means the gate and the levels can never quietly disagree
 * about which zone they're talking about.
 */
export function findNearestDefensibleZone(direction: ThesisDirection, candles: Candle[], price: number, atr: number | null): DefensibleZone | null {
  if (candles.length === 0 || price <= 0) return null;

  const { supports, resistances } = findSupportResistanceZones(candles, price);
  const maxDistance = atr !== null ? atr * INTEL_RULES.entryLocation.maxZoneDistanceAtrMult : price * 0.015;

  const zones = direction === 'LONG' ? supports : resistances;
  const nearestZone = zones.find((z) => Math.abs(z.price - price) <= maxDistance);
  if (nearestZone) return { price: nearestZone.price, touches: nearestZone.touches, source: 'zone' };

  const retest = detectRetest(candles, direction === 'LONG' ? 'bullish' : 'bearish');
  if (retest.isRetesting && retest.level !== null) return { price: retest.level, touches: 1, source: 'retest' };

  return null;
}

/**
 * Layer A hard gate, evaluated per candidate direction: is price actually
 * sitting at (or retesting) a structurally defensible zone for this
 * direction, or is it just floating mid-range/already extended? A LONG
 * needs a support-side zone (a support level itself, or a broken
 * resistance now being retested as support); a SHORT needs the mirror
 * image. No zone within range -> blocked, regardless of how good every
 * other category looks — this is what stops the engine from "chasing".
 */
export function evaluateEntryLocationQuality(
  direction: ThesisDirection,
  candles: Candle[],
  price: number,
  atr: number | null,
  sourceTimestamp: number,
  timeframe: 'multi' = 'multi',
): LayerACategoryEvidence {
  if (candles.length === 0 || price <= 0) {
    return blockedGate('entry_location_quality', timeframe, sourceTimestamp, 'No candle data to evaluate entry location.');
  }

  const zone = findNearestDefensibleZone(direction, candles, price, atr);
  if (!zone) {
    return blockedGate(
      'entry_location_quality',
      timeframe,
      sourceTimestamp,
      `No defensible ${direction === 'LONG' ? 'support' : 'resistance'} zone or retest within range of current price for a ${direction} entry.`,
    );
  }

  const bias = direction === 'LONG' ? 'bullish' : 'bearish';
  const strong = zone.touches >= 2 || zone.source === 'retest';
  const supporting = [
    zone.source === 'zone'
      ? fact(`${direction === 'LONG' ? 'Support' : 'Resistance'} zone at ${zone.price.toFixed(4)} (${zone.touches} touches).`, timeframe, sourceTimestamp)
      : fact(`Price is retesting the broken level at ${zone.price.toFixed(4)}.`, timeframe, sourceTimestamp),
  ];

  return layerAGate({
    category: 'entry_location_quality',
    gateStatus: 'usable',
    bias,
    conclusion: strong ? bias : direction === 'LONG' ? 'slightly_bullish' : 'slightly_bearish',
    supporting,
    timeframe,
    sourceTimestamp,
  });
}
