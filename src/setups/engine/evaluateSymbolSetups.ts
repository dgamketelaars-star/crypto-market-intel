import type { Candle } from '../../services/binance/types';
import type { SymbolAnalysis } from '../../analysis/engine/types';
import { ALL_FAMILIES, type FamilyResult } from '../families';
import { advanceOpenSetup, createSetup, evaluateActiveSetup, invalidateVanishedSetup, type ActivationContext } from '../lifecycle/lifecycle';
import { resolveSymbolDirection, type SymbolResolution } from './conflictResolution';
import { evaluateSetupQuality } from './qualityGate';
import { OPEN_SETUP_STATUSES, type DirectionRejection, type GeneratedSetup, type SetupDirection, type TradeHorizon } from './types';

interface QualifiedResult {
  result: FamilyResult;
  horizon: TradeHorizon;
}

export interface EvaluateSymbolSetupsInput {
  symbol: string;
  price: number;
  analysis: SymbolAnalysis;
  candles1h: Candle[];
  btcAnalysis: SymbolAnalysis | null;
  ethAnalysis: SymbolAnalysis | null;
  now: number;
  existingForSymbol: GeneratedSetup[];
  origin: 'live' | 'simulation';
  /** When true, ACTIVE setups are left untouched this tick (no status change on stale source data). */
  priceIsStale?: boolean;
}

export interface EvaluateSymbolSetupsResult {
  setups: GeneratedSetup[];
  resolution: SymbolResolution;
}

function familyKey(family: string, direction: string): string {
  return `${family}:${direction}`;
}

function buildActivationContext(
  direction: SetupDirection,
  resolution: SymbolResolution,
  existingActiveDirections: Set<SetupDirection>,
): ActivationContext {
  const isWinningDirection =
    (direction === 'LONG' && resolution.outcome === 'active_long') || (direction === 'SHORT' && resolution.outcome === 'active_short');
  const opposite: SetupDirection = direction === 'LONG' ? 'SHORT' : 'LONG';
  const oppositeAlreadyActive = existingActiveDirections.has(opposite);
  const allowActivation = isWinningDirection && !oppositeAlreadyActive;

  const directionRejection: DirectionRejection | null = isWinningDirection ? { rejectedDirection: opposite, reason: resolution.reason } : null;

  return { allowActivation, directionRejection };
}

/**
 * Pure, side-effect-free orchestrator shared by the live setup store and the
 * simulation engine: runs every setup family for one symbol, resolves any
 * LONG/SHORT conflict for the symbol, merges the results into existing
 * (open) setups, and lets closed setups pass through untouched. Callers own
 * persistence and store wiring.
 */
export function evaluateSymbolSetups(input: EvaluateSymbolSetupsInput): EvaluateSymbolSetupsResult {
  const { symbol, price, analysis, candles1h, btcAnalysis, ethAnalysis, now, existingForSymbol, origin, priceIsStale = false } = input;

  const openByKey = new Map<string, GeneratedSetup>();
  const passthrough: GeneratedSetup[] = [];
  const existingActiveDirections = new Set<SetupDirection>();
  for (const setup of existingForSymbol) {
    if (OPEN_SETUP_STATUSES.includes(setup.status)) {
      openByKey.set(familyKey(setup.family, setup.direction), setup);
      if (setup.status === 'active') existingActiveDirections.add(setup.direction);
    } else {
      passthrough.push(setup);
    }
  }

  const freshByKey = new Map<string, QualifiedResult>();
  if (!priceIsStale) {
    for (const family of ALL_FAMILIES) {
      const results = family.evaluate({ symbol, price, analysis, candles1h, btcAnalysis, ethAnalysis, now });
      if (!results) continue;
      for (const result of results) {
        // Quality gate: classifies the trade horizon first, then rejects a
        // result that fails structural stoploss placement, the
        // horizon-appropriate minimum stop/target distance, or has no
        // target clearing the minimum reward:risk without a degenerate
        // (mathematically inflated) R:R. Not a setup at all — reject it
        // here, before it can ever become or advance a GeneratedSetup. An
        // existing candidate whose fresh result now fails this check is
        // treated exactly like a vanished signal (falls through to
        // invalidateVanishedSetup below).
        const quality = evaluateSetupQuality(result, analysis);
        if (!quality.valid || !quality.horizon) continue;
        freshByKey.set(familyKey(result.family, result.direction), {
          result: { ...result, targets: quality.targets },
          horizon: quality.horizon,
        });
      }
    }
  }

  const resolution = resolveSymbolDirection([...freshByKey.values()].map((q) => q.result));
  const updated: GeneratedSetup[] = [...passthrough];

  for (const [key, setup] of openByKey) {
    const fresh = freshByKey.get(key);
    freshByKey.delete(key);

    if (setup.status === 'active') {
      updated.push(evaluateActiveSetup(setup, price, btcAnalysis, now, priceIsStale));
      continue;
    }
    if (priceIsStale) {
      updated.push(setup); // don't silently progress candidates on stale data either
      continue;
    }
    if (!fresh) {
      updated.push(invalidateVanishedSetup(setup, now));
      continue;
    }
    const activation = buildActivationContext(fresh.result.direction, resolution, existingActiveDirections);
    updated.push(advanceOpenSetup(setup, fresh.result, { analysis, btcAnalysis, price, now, activation, tradeHorizon: fresh.horizon }));
  }

  if (!priceIsStale) {
    for (const fresh of freshByKey.values()) {
      const activation = buildActivationContext(fresh.result.direction, resolution, existingActiveDirections);
      updated.push(createSetup(symbol, fresh.result, { btcAnalysis, analysis, price, now, origin, activation, tradeHorizon: fresh.horizon }));
    }
  }

  return { setups: updated, resolution };
}
