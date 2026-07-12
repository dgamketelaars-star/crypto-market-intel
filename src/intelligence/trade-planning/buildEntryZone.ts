import type { CandleInterval } from '../../services/binance/types';
import type { SetupLevel } from '../../setups/engine/types';
import { INTEL_RULES } from '../rules';
import type { DefensibleZone } from '../structure/entryLocation';

export interface EntryZoneResult {
  entryZone: { low: number; high: number };
  trigger: SetupLevel;
}

/**
 * Entry zone is structure-sourced only — built around the same defensible
 * zone the horizon decision found, never automatically "current price".
 * Width comes from the same clustering tolerance used to build the zone
 * itself (zoneTouchToleragePct), not an arbitrary ATR pick — see the
 * entry-zone rules in the trade-planning spec.
 */
export function buildEntryZone(zone: DefensibleZone, timeframe: CandleInterval): EntryZoneResult {
  const tolerance = zone.price * (INTEL_RULES.tradePlanning.entryZoneTolerancePct / 100);
  return {
    entryZone: { low: zone.price - tolerance, high: zone.price + tolerance },
    trigger: {
      price: zone.price,
      timeframe,
      method: zone.source === 'retest' ? 'retest-of-broken-level' : 'support-resistance-zone',
      explanation:
        zone.source === 'retest'
          ? `Price is retesting the broken structural level at ${zone.price.toFixed(4)}.`
          : `Structural zone at ${zone.price.toFixed(4)} (${zone.touches} touches).`,
    },
  };
}

/**
 * No chasing: price already beyond the entry zone by more than a small ATR
 * sanity cap at first sight means the move already happened — reject rather
 * than build a plan around an entry that isn't realistically reachable.
 */
export function isEntryMissed(price: number, entryZone: { low: number; high: number }, atr: number | null): boolean {
  if (price >= entryZone.low && price <= entryZone.high) return false;
  const distance = price < entryZone.low ? entryZone.low - price : price - entryZone.high;
  const cap = atr !== null ? atr * INTEL_RULES.tradePlanning.maxMissedEntryAtrMult : (entryZone.high - entryZone.low) * 2;
  return distance > cap;
}
