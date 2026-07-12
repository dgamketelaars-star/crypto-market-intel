import type { SymbolAnalysis } from '../../analysis/engine/types';
import type { EntryInfo, GeneratedSetup, SetupChangeLog, SetupLifecycleEvent, SetupTarget } from '../../setups/engine/types';
import { checkExpiry, closeOpenSetup, createLifecycleEvent, EMPTY_CHANGE_LOG } from '../../setups/lifecycle/lifecycle';
import type { ValidThesis } from '../thesis/types';
import type { ValidTradePlan } from '../trade-planning/types';
import { buildMarketContextAdjustment, priceInZone } from './createIntelligenceSetup';
import { buildSetupEvidenceLists } from './convertToSetupEvidence';

/** A price move smaller than this (relative) is noise, not a "the plan changed" event worth a warning — mirrors the paused engine's tolerance. */
const CHANGE_TOLERANCE = 0.0015;

function pricesDiffer(a: number, b: number): boolean {
  if (a === 0) return b !== 0;
  return Math.abs(a - b) / Math.abs(a) > CHANGE_TOLERANCE;
}

function targetPriceSignature(targets: { price: number }[]): number[] {
  return targets.map((t) => t.price);
}

function signatureDiffers(prev: number[], next: number[]): boolean {
  if (prev.length !== next.length) return true;
  return prev.some((v, i) => pricesDiffer(v, next[i]));
}

function detectPlanChanges(setup: GeneratedSetup, plan: ValidTradePlan, now: number): SetupChangeLog {
  const entryZoneChanged = pricesDiffer(setup.entryZone?.low ?? setup.trigger.price, plan.entryZone.low) || pricesDiffer(setup.entryZone?.high ?? setup.trigger.price, plan.entryZone.high);
  const invalidationChanged = pricesDiffer(setup.invalidation.price, plan.invalidation.price);
  const targetsChanged = signatureDiffers(targetPriceSignature(setup.targets), targetPriceSignature(plan.targets));
  return {
    entryZone: entryZoneChanged ? now : setup.changeLog.entryZone,
    invalidation: invalidationChanged ? now : setup.changeLog.invalidation,
    targets: targetsChanged ? now : setup.changeLog.targets,
  };
}

export interface AdvanceIntelligenceSetupContext {
  price: number;
  now: number;
  analysis: SymbolAnalysis;
  btcAnalysis: SymbolAnalysis | null;
}

/**
 * Advances a still-forming (waiting_for_confirmation) setup with a fresh
 * thesis + plan for the *same* symbol and direction. Trigger/invalidation/
 * entry-zone/targets can still move while forming; the moment the setup
 * activates they freeze for good (see the paused engine's lifecycle.ts,
 * whose freeze-on-activation rule this preserves).
 */
export function advanceIntelligenceSetup(setup: GeneratedSetup, thesis: ValidThesis, plan: ValidTradePlan, ctx: AdvanceIntelligenceSetupContext): GeneratedSetup {
  const expired = checkExpiry(setup, ctx.now);
  if (expired) return expired;

  const { supporting, opposing, missingData } = buildSetupEvidenceLists(thesis);
  const marketContext = buildMarketContextAdjustment(thesis);
  const becomingActive = priceInZone(ctx.price, plan.entryZone);
  const wasAlreadyActive = setup.status === 'active';

  const events: SetupLifecycleEvent[] = [];
  let entry: EntryInfo | null = setup.entry;
  if (becomingActive && !wasAlreadyActive) {
    entry = {
      activatedAt: ctx.now,
      triggerPrice: plan.trigger.price,
      firstLivePrice: ctx.price,
      entryZone: plan.entryZone,
      highestFavorableExcursion: ctx.price,
      largestAdverseExcursion: ctx.price,
      entryMissed: false,
    };
    events.push(createLifecycleEvent('confirmation_received', 'Prijs is de entry-zone binnengekomen.', ctx.now));
    events.push(createLifecycleEvent('setup_activated', 'Trigger bevestigd — setup is nu actief.', ctx.now));
  }
  if (thesis.signalStrength !== setup.signalStrength) {
    events.push(createLifecycleEvent('strength_changed', `Signal strength gewijzigd van ${setup.signalStrength} naar ${thesis.signalStrength}.`, ctx.now));
  }
  if (plan.risk !== setup.risk) {
    events.push(createLifecycleEvent('risk_changed', `Risk gewijzigd van ${setup.risk} naar ${plan.risk}.`, ctx.now));
  }
  if (marketContext.applied && marketContext.reason !== setup.marketContext.reason) {
    events.push(createLifecycleEvent('context_adjustment', marketContext.reason, ctx.now));
  }

  // Activation freezes the plan for good — pre-activation churn is stale news on a freshly-committed setup.
  const changeLog = wasAlreadyActive || becomingActive ? EMPTY_CHANGE_LOG : detectPlanChanges(setup, plan, ctx.now);
  const useFreshLevels = !wasAlreadyActive;

  return {
    ...setup,
    status: becomingActive ? 'active' : 'waiting_for_confirmation',
    lastEvaluatedAt: ctx.now,
    tradeHorizon: plan.horizon,
    signalStrength: thesis.signalStrength,
    risk: plan.risk,
    trigger: useFreshLevels ? plan.trigger : setup.trigger,
    invalidation: useFreshLevels ? plan.invalidation : setup.invalidation,
    entryZone: useFreshLevels ? plan.entryZone : setup.entryZone,
    targets: (useFreshLevels ? plan.targets : setup.targets) as SetupTarget[],
    supporting,
    opposing,
    missingData,
    marketContext,
    sourceDataTimestamps: { symbol: ctx.analysis.dataTimestamp, btc: ctx.btcAnalysis?.dataTimestamp ?? null },
    lifecycle: events.length ? [...setup.lifecycle, ...events] : setup.lifecycle,
    entry,
    changeLog,
  };
}

/** The fresh evaluation no longer produces a matching thesis/plan for this symbol+direction — the thesis that created this setup no longer holds. */
export function invalidateVanishedIntelligenceSetup(setup: GeneratedSetup, now: number): GeneratedSetup {
  const expired = checkExpiry(setup, now);
  if (expired) return expired;
  return closeOpenSetup(setup, 'invalidated', 'De onderliggende thesis is niet langer geldig — evidence-synthese wijst niet meer op deze richting.', now);
}
