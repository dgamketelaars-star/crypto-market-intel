import type { SymbolAnalysis } from '../../analysis/engine/types';
import { SETUP_RULE_VERSION } from '../../setups/engine/rules';
import type { EntryInfo, GeneratedSetup, MarketContextAdjustment, SetupLifecycleEvent } from '../../setups/engine/types';
import { createLifecycleEvent, EMPTY_CHANGE_LOG } from '../../setups/lifecycle/lifecycle';
import { buildSetupEvidenceLists } from './convertToSetupEvidence';
import type { ValidThesis } from '../thesis/types';
import type { ValidTradePlan } from '../trade-planning/types';

export function priceInZone(price: number, zone: { low: number; high: number }): boolean {
  return price >= zone.low && price <= zone.high;
}

const HORIZON_DURATION_LABEL: Record<ValidTradePlan['horizon'], string> = {
  DAY_TRADE: 'Uren tot ~1 dag',
  SWING_TRADE: 'Meerdere dagen tot enkele weken',
};

export function buildMarketContextAdjustment(thesis: ValidThesis): MarketContextAdjustment {
  if (thesis.contextAdjustments.length === 0) {
    return { applied: false, reason: '', effect: 'none' };
  }
  return { applied: true, reason: thesis.contextAdjustments.join('; '), effect: 'requires_stronger_confirmation' };
}

export interface CreateIntelligenceSetupContext {
  price: number;
  now: number;
  origin: 'live' | 'simulation';
  analysis: SymbolAnalysis;
  btcAnalysis: SymbolAnalysis | null;
}

/**
 * Builds a fresh GeneratedSetup from a VALID thesis + VALID trade plan —
 * the intelligence pipeline's equivalent of the paused engine's
 * createSetup(), but with no family/readiness concept: the thesis and plan
 * already establish direction, entry, stop and targets, so there is no
 * separate "candidate, far from actionable" phase (Phase 2's evidence gates
 * already filtered that out upstream). A setup starts either 'active' (price
 * is already inside the entry zone) or 'waiting_for_confirmation' (price is
 * close but not there yet) — never 'candidate'.
 */
export function createIntelligenceSetup(symbol: string, thesis: ValidThesis, plan: ValidTradePlan, ctx: CreateIntelligenceSetupContext): GeneratedSetup {
  const { price, now, origin, analysis, btcAnalysis } = ctx;
  const { supporting, opposing, missingData } = buildSetupEvidenceLists(thesis);
  const marketContext = buildMarketContextAdjustment(thesis);

  const isActive = priceInZone(price, plan.entryZone);
  const entry: EntryInfo | null = isActive
    ? {
        activatedAt: now,
        triggerPrice: plan.trigger.price,
        firstLivePrice: price,
        entryZone: plan.entryZone,
        highestFavorableExcursion: price,
        largestAdverseExcursion: price,
        entryMissed: false,
      }
    : null;

  const events: SetupLifecycleEvent[] = [
    createLifecycleEvent('candidate_created', `Evidence-based ${thesis.direction}-thesis gevormd voor ${symbol} (signal strength: ${thesis.signalStrength}).`, now),
  ];
  if (isActive) {
    events.push(createLifecycleEvent('confirmation_received', 'Prijs bevond zich al binnen de entry-zone bij thesis-vorming.', now));
    events.push(createLifecycleEvent('setup_activated', 'Setup direct geactiveerd.', now));
  } else {
    events.push(createLifecycleEvent('trigger_approached', 'Prijs nadert de entry-zone maar is er nog niet binnen.', now));
  }
  if (marketContext.applied) {
    events.push(createLifecycleEvent('context_adjustment', marketContext.reason, now));
  }

  return {
    id: `${symbol}-evidence_based_thesis-${thesis.direction}-${now}`,
    symbol,
    direction: thesis.direction,
    family: 'evidence_based_thesis',
    status: isActive ? 'active' : 'waiting_for_confirmation',
    createdAt: now,
    lastEvaluatedAt: now,
    tradeHorizon: plan.horizon,
    expectedDuration: HORIZON_DURATION_LABEL[plan.horizon],
    signalStrength: thesis.signalStrength,
    risk: plan.risk,
    trigger: plan.trigger,
    invalidation: plan.invalidation,
    entryZone: plan.entryZone,
    targets: plan.targets,
    supporting,
    opposing,
    missingData,
    marketContext,
    ruleVersion: SETUP_RULE_VERSION,
    sourceDataTimestamps: { symbol: analysis.dataTimestamp, btc: btcAnalysis?.dataTimestamp ?? null },
    lifecycle: events,
    origin,
    closedAt: null,
    closedReason: null,
    closedPrice: null,
    entry,
    directionRejection: null,
    changeLog: EMPTY_CHANGE_LOG,
  };
}
