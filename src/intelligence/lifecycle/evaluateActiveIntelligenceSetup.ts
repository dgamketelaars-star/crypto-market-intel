import { formatUsdPrice } from '../../utils/format';
import type { EntryInfo, GeneratedSetup, SetupLifecycleEvent, SetupTarget } from '../../setups/engine/types';
import { closeOpenSetup, createLifecycleEvent } from '../../setups/lifecycle/lifecycle';
import { updateExcursions } from '../../setups/levels/entryTracking';

/**
 * Tracks an ACTIVE intelligence-pipeline setup against its own frozen
 * trigger/invalidation/target levels — those levels are never rewritten
 * once active. Deliberately does not carry over the paused engine's
 * BTC-4H-trend force-invalidate check (applyMarketContextGate): in this
 * pipeline, market context is Layer C evidence consulted once at thesis
 * formation, not a continuous invalidation trigger — an active setup's fate
 * is decided purely by price reaching its own frozen levels. On stale
 * source data, nothing is evaluated: the last known state is kept as-is.
 */
export function evaluateActiveIntelligenceSetup(setup: GeneratedSetup, price: number, now: number, dataIsStale = false): GeneratedSetup {
  if (dataIsStale) return setup;
  if (!setup.entry) return setup; // defensive: should never happen for a truly active setup

  const isLong = setup.direction === 'LONG';
  const invalidationHit = isLong ? price <= setup.invalidation.price : price >= setup.invalidation.price;

  const excursions = updateExcursions(setup.direction, setup.entry.highestFavorableExcursion, setup.entry.largestAdverseExcursion, price);
  const entry: EntryInfo = { ...setup.entry, highestFavorableExcursion: excursions.favorable, largestAdverseExcursion: excursions.adverse };

  if (invalidationHit) {
    const closed = closeOpenSetup(setup, 'invalidated', `Prijs (${formatUsdPrice(price)}) raakte het invalidation-niveau (${formatUsdPrice(setup.invalidation.price)}).`, now, price);
    return { ...closed, entry };
  }

  const events: SetupLifecycleEvent[] = [];
  const updatedTargets = setup.targets.map((target) => {
    if (target.status !== 'pending') return target;
    const reached = isLong ? price >= target.price : price <= target.price;
    if (!reached) return target;
    events.push(createLifecycleEvent('target_reached', `Target ${target.order} (${formatUsdPrice(target.price)}, ${target.positionPortionPct}% van het voorbeeldplan) bereikt (${target.method}).`, now));
    return { ...target, status: target.isFinal ? 'completed' : 'reached' } as SetupTarget;
  });

  const finalTarget = updatedTargets.find((t) => t.isFinal);
  if (finalTarget?.status === 'completed') {
    events.push(createLifecycleEvent('setup_completed', 'Setup afgerond: laatste koersdoel bereikt.', now));
    return { ...setup, status: 'completed', lastEvaluatedAt: now, closedAt: now, closedReason: 'target', closedPrice: price, targets: updatedTargets, entry, lifecycle: [...setup.lifecycle, ...events] };
  }

  return { ...setup, lastEvaluatedAt: now, targets: updatedTargets, entry, lifecycle: events.length ? [...setup.lifecycle, ...events] : setup.lifecycle };
}
