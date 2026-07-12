import type { SymbolAnalysis } from '../../analysis/engine/types';
import { formatUsdPrice } from '../../utils/format';
import { applyMarketContextGate } from '../context/marketContextGate';
import type { FamilyReadiness } from '../engine/readiness';
import { SETUP_RULES, SETUP_RULE_VERSION } from '../engine/rules';
import type {
  DirectionRejection,
  EntryInfo,
  GeneratedSetup,
  LifecycleEventType,
  SetupChangeLog,
  SetupDirection,
  SetupLifecycleEvent,
  SetupStatus,
  SetupTarget,
  TradeHorizon,
} from '../engine/types';
import type { FamilyResult } from '../families/shared';
import { calculateEntryDistance, isEntryMissed, updateExcursions } from '../levels/entryTracking';
import { finalizeTargets } from '../levels/targetPortions';
import { calculateRisk } from '../scoring/risk';
import { calculateSignalStrength, downgradeStrength } from '../scoring/strength';
import { expectedDurationLabel } from '../engine/tradeHorizon';

export function createLifecycleEvent(type: LifecycleEventType, detail: string, timestamp: number): SetupLifecycleEvent {
  return { timestamp, type, detail };
}

function statusFromReadiness(readiness: Exclude<FamilyReadiness, 'none'>): SetupStatus {
  return readiness === 'active_ready' ? 'active' : readiness;
}

/** When the context gate demands stronger confirmation, hold readiness back one step — unless volume is a clean spike. */
function applyContextCap(
  readiness: Exclude<FamilyReadiness, 'none'>,
  requireStronger: boolean,
  volumeIsSpike: boolean,
): Exclude<FamilyReadiness, 'none'> {
  if (!requireStronger || volumeIsSpike) return readiness;
  if (readiness === 'active_ready') return 'waiting_for_confirmation';
  if (readiness === 'waiting_for_confirmation') return 'candidate';
  return readiness;
}

function buildRiskInput(fresh: FamilyResult, analysis: SymbolAnalysis, direction: SetupDirection, btcContextAdverse: boolean) {
  const tf1h = analysis.timeframes['1h'];
  const tf4h = analysis.timeframes['4h'];
  const timeframeConflict = Boolean(
    tf1h?.trend.sufficientData &&
      tf4h?.trend.sufficientData &&
      ((tf1h.trend.classification === 'uptrend' && tf4h.trend.classification === 'downtrend') ||
        (tf1h.trend.classification === 'downtrend' && tf4h.trend.classification === 'uptrend')),
  );

  const atr = tf1h?.volatility.atr14.value ?? null;
  const opposingZone = tf1h ? (direction === 'LONG' ? tf1h.structure.nearestResistance : tf1h.structure.nearestSupport) : null;
  const nearOpposingZoneAtrRatio = atr && atr > 0 && opposingZone ? Math.abs(opposingZone.price - fresh.trigger.price) / atr : null;

  const bestRewardToRisk = fresh.targets.reduce<number | null>((best, t) => {
    if (t.rewardToRisk === null) return best;
    return best === null ? t.rewardToRisk : Math.max(best, t.rewardToRisk);
  }, null);

  return {
    direction,
    volatility: tf1h?.volatility.classification ?? ('insufficient_data' as const),
    quoteVolumeRank: analysis.volume.quoteVolumeRank,
    universeSize: analysis.volume.universeSize,
    fundingState: analysis.positioning.fundingState,
    timeframeConflict,
    nearOpposingZoneAtrRatio,
    rewardToRisk: bestRewardToRisk,
    btcContextAdverse,
    missingDataCount: fresh.missingData.length,
  };
}

export const EMPTY_CHANGE_LOG: SetupChangeLog = { entryZone: null, invalidation: null, targets: null };

/** A price move smaller than this (relative) is ATR-driven noise, not a "the plan changed" event worth a warning. */
const CHANGE_TOLERANCE = 0.0015;

function pricesDiffer(a: number, b: number): boolean {
  if (a === 0) return b !== 0;
  return Math.abs(a - b) / Math.abs(a) > CHANGE_TOLERANCE;
}

function entryZoneSignature(zone: { low: number; high: number } | null, triggerPrice: number): [number, number] {
  return zone ? [zone.low, zone.high] : [triggerPrice, triggerPrice];
}

function targetPriceSignature(targets: { price: number }[]): number[] {
  return targets.map((t) => t.price);
}

function signatureDiffers(prev: number[], next: number[]): boolean {
  if (prev.length !== next.length) return true;
  return prev.some((v, i) => pricesDiffer(v, next[i]));
}

/**
 * Compares a still-forming setup's previous plan fields against a fresh
 * evaluation and stamps `now` into whichever field materially changed (a
 * small relative tolerance filters out ATR-driven noise so the "⚠️ field
 * gewijzigd" warning doesn't fire on every tick). Fields that didn't change
 * carry their previous change timestamp forward untouched.
 */
function detectPlanChanges(setup: GeneratedSetup, fresh: FamilyResult, freshTargets: SetupTarget[], now: number): SetupChangeLog {
  const entryZoneChanged = signatureDiffers(
    entryZoneSignature(setup.entryZone, setup.trigger.price),
    entryZoneSignature(fresh.entryZone, fresh.trigger.price),
  );
  const invalidationChanged = pricesDiffer(setup.invalidation.price, fresh.invalidation.price);
  const targetsChanged = signatureDiffers(targetPriceSignature(setup.targets), targetPriceSignature(freshTargets));

  return {
    entryZone: entryZoneChanged ? now : setup.changeLog.entryZone,
    invalidation: invalidationChanged ? now : setup.changeLog.invalidation,
    targets: targetsChanged ? now : setup.changeLog.targets,
  };
}

/** Whether this direction is allowed to *activate* right now, and why the opposite direction lost (if relevant). */
export interface ActivationContext {
  allowActivation: boolean;
  directionRejection: DirectionRejection | null;
}

interface ActivationResolution {
  status: SetupStatus;
  targets: SetupTarget[];
  entry: EntryInfo | null;
  note: string | null;
}

/**
 * The single place that turns "readiness says active" into an actual active
 * setup: finalizes the staged-exit target plan, refuses to activate without
 * at least one defensible target, refuses to activate when conflict
 * resolution didn't award this direction the win, and records the immutable
 * entry snapshot (including missed-entry detection).
 */
function resolveActivation(
  fresh: FamilyResult,
  requestedStatus: SetupStatus,
  activation: ActivationContext,
  price: number,
  analysis: SymbolAnalysis,
  now: number,
): ActivationResolution {
  const volatility = analysis.timeframes['1h']?.volatility.classification ?? 'insufficient_data';
  const targets = finalizeTargets(fresh.targets, fresh.direction, volatility);

  if (requestedStatus !== 'active') {
    return { status: requestedStatus, targets, entry: null, note: null };
  }
  if (!activation.allowActivation) {
    return {
      status: 'waiting_for_confirmation',
      targets,
      entry: null,
      note: 'Setup niet geactiveerd: een andere richting domineert of de resultaten zijn tegenstrijdig voor dit symbool.',
    };
  }
  if (targets.length === 0) {
    return {
      status: 'waiting_for_confirmation',
      targets,
      entry: null,
      note: 'Setup niet geactiveerd: geen koersdoel voldoet aan de minimale reward:risk-eis.',
    };
  }

  const entryMissed = isEntryMissed(fresh.direction, fresh.trigger.price, price, fresh.atr);
  const entry: EntryInfo = {
    activatedAt: now,
    triggerPrice: fresh.trigger.price,
    firstLivePrice: price,
    entryZone: fresh.entryZone,
    highestFavorableExcursion: price,
    largestAdverseExcursion: price,
    entryMissed,
  };
  return { status: 'active', targets, entry, note: null };
}

export function createSetup(
  symbol: string,
  fresh: FamilyResult,
  ctx: {
    btcAnalysis: SymbolAnalysis | null;
    analysis: SymbolAnalysis;
    price: number;
    now: number;
    origin: 'live' | 'simulation';
    activation: ActivationContext;
    tradeHorizon: TradeHorizon;
  },
): GeneratedSetup {
  const gate = applyMarketContextGate(symbol, fresh.direction, ctx.btcAnalysis);
  const volumeIsSpike = ctx.analysis.volume.classification === 'spike';
  const cappedReadiness = applyContextCap(fresh.readiness, gate.requireStrongerConfirmation, volumeIsSpike);
  const requestedStatus = statusFromReadiness(cappedReadiness);

  const activation = resolveActivation(fresh, requestedStatus, ctx.activation, ctx.price, ctx.analysis, ctx.now);

  let strength = calculateSignalStrength(fresh.supporting, fresh.opposing);
  if (gate.requireStrongerConfirmation) strength = downgradeStrength(strength, 1);
  const risk = calculateRisk(buildRiskInput(fresh, ctx.analysis, fresh.direction, gate.adjustment.applied));

  const events: SetupLifecycleEvent[] = [
    createLifecycleEvent(
      'candidate_created',
      `${fresh.family.replace(/_/g, ' ')} ${fresh.direction}-candidate gedetecteerd voor ${symbol}.`,
      ctx.now,
    ),
  ];
  if (activation.status === 'waiting_for_confirmation' && requestedStatus !== 'active') {
    events.push(createLifecycleEvent('trigger_approached', 'Prijs bevindt zich al dicht bij het triggerniveau.', ctx.now));
  }
  if (activation.note) {
    events.push(createLifecycleEvent('context_adjustment', activation.note, ctx.now));
  }
  if (activation.status === 'active') {
    events.push(createLifecycleEvent('confirmation_received', 'Alle bevestigingsvoorwaarden waren al vervuld bij eerste detectie.', ctx.now));
    events.push(createLifecycleEvent('setup_activated', 'Setup direct geactiveerd bij eerste detectie.', ctx.now));
    if (activation.entry?.entryMissed) {
      events.push(
        createLifecycleEvent(
          'context_adjustment',
          `Entry missed — prijs stond al te ver van de trigger (${formatUsdPrice(fresh.trigger.price)}) toen de setup werd gedetecteerd.`,
          ctx.now,
        ),
      );
    }
  }
  if (gate.adjustment.applied) {
    events.push(createLifecycleEvent('context_adjustment', gate.adjustment.reason, ctx.now));
  }

  return {
    id: `${symbol}-${fresh.family}-${fresh.direction}-${ctx.now}`,
    symbol,
    direction: fresh.direction,
    family: fresh.family,
    status: activation.status,
    createdAt: ctx.now,
    lastEvaluatedAt: ctx.now,
    tradeHorizon: ctx.tradeHorizon,
    expectedDuration: expectedDurationLabel[ctx.tradeHorizon],
    signalStrength: strength,
    risk,
    trigger: fresh.trigger,
    invalidation: fresh.invalidation,
    entryZone: fresh.entryZone,
    targets: activation.targets,
    supporting: fresh.supporting,
    opposing: fresh.opposing,
    missingData: fresh.missingData,
    marketContext: gate.adjustment,
    ruleVersion: SETUP_RULE_VERSION,
    sourceDataTimestamps: { symbol: ctx.analysis.dataTimestamp, btc: ctx.btcAnalysis?.dataTimestamp ?? null },
    lifecycle: events,
    origin: ctx.origin,
    closedAt: null,
    closedReason: null,
    closedPrice: null,
    entry: activation.entry,
    directionRejection: activation.status === 'active' ? ctx.activation.directionRejection : null,
    changeLog: EMPTY_CHANGE_LOG,
  };
}

export function closeOpenSetup(
  setup: GeneratedSetup,
  status: 'invalidated' | 'expired',
  reason: string,
  now: number,
  price: number | null = null,
): GeneratedSetup {
  const type: LifecycleEventType = status === 'invalidated' ? 'setup_invalidated' : 'setup_expired';
  return {
    ...setup,
    status,
    lastEvaluatedAt: now,
    closedAt: now,
    closedReason: status === 'invalidated' ? 'invalidation' : 'expired',
    // Only a setup that had actually activated has a real exit price — a
    // candidate/waiting setup that expires or invalidates before entry never
    // had a position to exit.
    closedPrice: setup.status === 'active' ? price : null,
    lifecycle: [...setup.lifecycle, createLifecycleEvent(type, reason, now)],
  };
}

export function checkExpiry(setup: GeneratedSetup, now: number): GeneratedSetup | null {
  const age = now - setup.createdAt;
  if (age <= SETUP_RULES.expiry.maxOpenAgeMs) return null;
  const hours = (age / 3_600_000).toFixed(0);
  const maxHours = (SETUP_RULES.expiry.maxOpenAgeMs / 3_600_000).toFixed(0);
  return closeOpenSetup(setup, 'expired', `Setup verliep na ${hours} uur zonder bevestiging (maximum ${maxHours}u).`, now);
}

/** Advances a candidate/waiting_for_confirmation setup using a fresh family evaluation. */
export function advanceOpenSetup(
  setup: GeneratedSetup,
  fresh: FamilyResult,
  ctx: {
    analysis: SymbolAnalysis;
    btcAnalysis: SymbolAnalysis | null;
    price: number;
    now: number;
    activation: ActivationContext;
    tradeHorizon: TradeHorizon;
  },
): GeneratedSetup {
  const gate = applyMarketContextGate(setup.symbol, setup.direction, ctx.btcAnalysis);
  if (gate.forceInvalidate) {
    return closeOpenSetup(setup, 'invalidated', gate.adjustment.reason, ctx.now);
  }

  const expired = checkExpiry(setup, ctx.now);
  if (expired) return expired;

  const volumeIsSpike = ctx.analysis.volume.classification === 'spike';
  const cappedReadiness = applyContextCap(fresh.readiness, gate.requireStrongerConfirmation, volumeIsSpike);
  const requestedStatus = statusFromReadiness(cappedReadiness);
  const activation = resolveActivation(fresh, requestedStatus, ctx.activation, ctx.price, ctx.analysis, ctx.now);

  let strength = calculateSignalStrength(fresh.supporting, fresh.opposing);
  if (gate.requireStrongerConfirmation) strength = downgradeStrength(strength, 1);
  const risk = calculateRisk(buildRiskInput(fresh, ctx.analysis, setup.direction, gate.adjustment.applied));

  const events: SetupLifecycleEvent[] = [];
  if (activation.status !== setup.status) {
    if (activation.status === 'waiting_for_confirmation' && setup.status === 'candidate') {
      events.push(createLifecycleEvent('trigger_approached', 'Prijs nadert het triggerniveau.', ctx.now));
    }
    if (activation.status === 'active') {
      events.push(createLifecycleEvent('confirmation_received', 'Alle bevestigingsvoorwaarden zijn vervuld.', ctx.now));
      events.push(createLifecycleEvent('setup_activated', 'Trigger bevestigd — setup is nu actief.', ctx.now));
      if (activation.entry?.entryMissed) {
        events.push(
          createLifecycleEvent(
            'context_adjustment',
            `Entry missed — prijs staat al te ver van de trigger (${formatUsdPrice(fresh.trigger.price)}).`,
            ctx.now,
          ),
        );
      }
    }
  }
  if (activation.note && activation.status !== 'active') {
    events.push(createLifecycleEvent('context_adjustment', activation.note, ctx.now));
  }
  if (strength !== setup.signalStrength) {
    events.push(createLifecycleEvent('strength_changed', `Signal strength gewijzigd van ${setup.signalStrength} naar ${strength}.`, ctx.now));
  }
  if (risk !== setup.risk) {
    events.push(createLifecycleEvent('risk_changed', `Risk gewijzigd van ${setup.risk} naar ${risk}.`, ctx.now));
  }
  if (gate.adjustment.applied && gate.adjustment.reason !== setup.marketContext.reason) {
    events.push(createLifecycleEvent('context_adjustment', gate.adjustment.reason, ctx.now));
  }

  // Activation freezes the plan for good — any pre-activation churn is now
  // stale news, not something worth warning about on a freshly-committed setup.
  const changeLog =
    activation.status === 'active' ? EMPTY_CHANGE_LOG : detectPlanChanges(setup, fresh, activation.targets, ctx.now);

  return {
    ...setup,
    status: activation.status,
    lastEvaluatedAt: ctx.now,
    tradeHorizon: ctx.tradeHorizon,
    expectedDuration: expectedDurationLabel[ctx.tradeHorizon],
    signalStrength: strength,
    risk,
    // Trigger/invalidation/targets/entryZone/tradeHorizon may still move
    // while the thesis is forming (candidate/waiting) — they freeze the
    // moment the setup activates.
    trigger: fresh.trigger,
    invalidation: fresh.invalidation,
    entryZone: fresh.entryZone,
    targets: activation.targets,
    supporting: fresh.supporting,
    opposing: fresh.opposing,
    missingData: fresh.missingData,
    marketContext: gate.adjustment,
    sourceDataTimestamps: { symbol: ctx.analysis.dataTimestamp, btc: ctx.btcAnalysis?.dataTimestamp ?? null },
    lifecycle: events.length ? [...setup.lifecycle, ...events] : setup.lifecycle,
    entry: activation.entry ?? setup.entry,
    directionRejection: activation.status === 'active' ? ctx.activation.directionRejection : setup.directionRejection,
    changeLog,
  };
}

/** A candidate/waiting setup whose context conditions no longer hold at all — the thesis broke before it ever activated. */
export function invalidateVanishedSetup(setup: GeneratedSetup, now: number): GeneratedSetup {
  const expired = checkExpiry(setup, now);
  if (expired) return expired;
  return closeOpenSetup(setup, 'invalidated', 'Contextvoorwaarden zijn niet langer geldig — de oorspronkelijke thesis is vervallen.', now);
}

/**
 * Evaluates an ACTIVE setup against its own frozen trigger/invalidation/target
 * levels — those levels are never rewritten. Only price crossing them (or a
 * forced BTC-context invalidation) can close the setup. Non-final targets
 * only mark that portion "reached" (an example staged exit) — the setup
 * stays active until the final target or invalidation closes it. On stale
 * source data, nothing is evaluated: the last known state is kept as-is.
 */
export function evaluateActiveSetup(
  setup: GeneratedSetup,
  price: number,
  btcAnalysis: SymbolAnalysis | null,
  now: number,
  dataIsStale = false,
): GeneratedSetup {
  if (dataIsStale) return setup;
  if (!setup.entry) return setup; // defensive: should never happen for a truly active setup

  const gate = applyMarketContextGate(setup.symbol, setup.direction, btcAnalysis);
  if (gate.forceInvalidate) {
    return closeOpenSetup(setup, 'invalidated', gate.adjustment.reason, now, price);
  }

  const isLong = setup.direction === 'LONG';
  const invalidationHit = isLong ? price <= setup.invalidation.price : price >= setup.invalidation.price;

  const excursions = updateExcursions(setup.direction, setup.entry.highestFavorableExcursion, setup.entry.largestAdverseExcursion, price);
  const entry: EntryInfo = {
    ...setup.entry,
    highestFavorableExcursion: excursions.favorable,
    largestAdverseExcursion: excursions.adverse,
  };

  if (invalidationHit) {
    const closed = closeOpenSetup(
      setup,
      'invalidated',
      `Prijs (${formatUsdPrice(price)}) raakte het invalidation-niveau (${formatUsdPrice(setup.invalidation.price)}).`,
      now,
      price,
    );
    return { ...closed, entry };
  }

  const events: SetupLifecycleEvent[] = [];
  const updatedTargets = setup.targets.map((target) => {
    if (target.status !== 'pending') return target;
    const reached = isLong ? price >= target.price : price <= target.price;
    if (!reached) return target;
    events.push(
      createLifecycleEvent(
        'target_reached',
        `Target ${target.order} (${formatUsdPrice(target.price)}, ${target.positionPortionPct}% van het voorbeeldplan) bereikt (${target.method}).`,
        now,
      ),
    );
    return { ...target, status: target.isFinal ? 'completed' : 'reached' } as SetupTarget;
  });

  const finalTarget = updatedTargets.find((t) => t.isFinal);
  if (finalTarget?.status === 'completed') {
    events.push(createLifecycleEvent('setup_completed', 'Setup afgerond: laatste koersdoel bereikt.', now));
    return {
      ...setup,
      status: 'completed',
      lastEvaluatedAt: now,
      closedAt: now,
      closedReason: 'target',
      closedPrice: price,
      targets: updatedTargets,
      entry,
      lifecycle: [...setup.lifecycle, ...events],
    };
  }

  if (gate.adjustment.applied && gate.adjustment.reason !== setup.marketContext.reason) {
    events.push(createLifecycleEvent('context_adjustment', gate.adjustment.reason, now));
  }

  return {
    ...setup,
    lastEvaluatedAt: now,
    targets: updatedTargets,
    entry,
    marketContext: gate.adjustment,
    lifecycle: events.length ? [...setup.lifecycle, ...events] : setup.lifecycle,
  };
}

export { calculateEntryDistance };
