import type { SymbolAnalysis } from '../analysis/engine/types';
import type { Candle, CandleInterval, LiquidationEvent, LongShortRatioData } from '../services/binance/types';
import type { GeneratedSetup } from '../setups/engine/types';
import { OPEN_SETUP_STATUSES } from '../setups/engine/types';
import { checkExpiry, closeOpenSetup } from '../setups/lifecycle/lifecycle';
import { synthesizeEvidence } from './evidence/synthesize';
import { advanceIntelligenceSetup, invalidateVanishedIntelligenceSetup } from './lifecycle/advanceIntelligenceSetup';
import { createIntelligenceSetup } from './lifecycle/createIntelligenceSetup';
import { evaluateActiveIntelligenceSetup } from './lifecycle/evaluateActiveIntelligenceSetup';
import { decideThesis } from './thesis/decisionFlow';
import { planTrade } from './trade-planning/planTrade';

export interface OrchestrateSymbolInput {
  symbol: string;
  price: number;
  markPrice: number | null;
  analysis: SymbolAnalysis;
  candles: Partial<Record<CandleInterval, Candle[]>>;
  btcAnalysis: SymbolAnalysis | null;
  ethAnalysis: SymbolAnalysis | null;
  breadthBullishSharePct: number | null;
  recentLiquidations: LiquidationEvent[];
  longShortRatio: LongShortRatioData | null;
  now: number;
  existingForSymbol: GeneratedSetup[];
  origin: 'live' | 'simulation';
  priceIsStale?: boolean;
}

/**
 * The intelligence pipeline's equivalent of the paused engine's
 * evaluateSymbolSetups.ts, run once per symbol per store recompute. Unlike
 * the old engine, there is no multi-family loop and no activation-time
 * conflict resolution to run: decideThesis() already resolves to at most
 * one direction (or NO_THESIS) per symbol by construction, so this module
 * only ever tracks a single open setup per symbol at a time.
 */
export function orchestrateSymbolSetup(input: OrchestrateSymbolInput): { setups: GeneratedSetup[] } {
  const { symbol, price, markPrice, analysis, candles, btcAnalysis, ethAnalysis, breadthBullishSharePct, recentLiquidations, longShortRatio, now, existingForSymbol, origin, priceIsStale = false } = input;

  const passthrough: GeneratedSetup[] = [];
  let openSetup: GeneratedSetup | null = null;
  for (const setup of existingForSymbol) {
    if (OPEN_SETUP_STATUSES.includes(setup.status)) openSetup = setup;
    else passthrough.push(setup);
  }

  if (priceIsStale) {
    if (openSetup?.status === 'active') {
      return { setups: [...passthrough, evaluateActiveIntelligenceSetup(openSetup, price, now, true)] };
    }
    return { setups: openSetup ? [...passthrough, openSetup] : passthrough };
  }

  if (openSetup?.status === 'active') {
    return { setups: [...passthrough, evaluateActiveIntelligenceSetup(openSetup, price, now)] };
  }

  const synthesis = synthesizeEvidence({ symbol, analysis, candles, price, markPrice, btcAnalysis, ethAnalysis, breadthBullishSharePct, recentLiquidations, longShortRatio, now });
  const thesis = decideThesis(symbol, synthesis);

  if (thesis.outcome === 'NO_THESIS') {
    if (!openSetup) return { setups: passthrough };
    return { setups: [...passthrough, invalidateVanishedIntelligenceSetup(openSetup, now)] };
  }

  const timeframe1h = analysis.timeframes['1h'];
  const timeframe4h = analysis.timeframes['4h'];
  const plan = planTrade({
    direction: thesis.direction,
    price,
    candles1h: candles['1h'] ?? [],
    candles4h: candles['4h'] ?? [],
    atr1h: timeframe1h?.volatility.atr14.value ?? null,
    atr4h: timeframe4h?.volatility.atr14.value ?? null,
    volatility4h: timeframe4h?.volatility.classification ?? 'insufficient_data',
    derivativesEvidence: synthesis.layers.layerC.derivativesPositioning,
    btcContextEvidence: synthesis.layers.layerC.btcEthContext,
    quoteVolumeRank: analysis.volume.quoteVolumeRank,
    universeSize: analysis.volume.universeSize,
    priceVsEma200Pct: timeframe4h?.trend.priceVsEma200Pct ?? null,
    recentLiquidations,
    now,
  });

  if (plan.outcome === 'NO_PLAN') {
    if (!openSetup) return { setups: passthrough };
    return { setups: [...passthrough, invalidateVanishedIntelligenceSetup(openSetup, now)] };
  }

  const ctx = { price, now, analysis, btcAnalysis };

  if (!openSetup) {
    return { setups: [...passthrough, createIntelligenceSetup(symbol, thesis, plan, { ...ctx, origin })] };
  }

  if (openSetup.direction === thesis.direction) {
    return { setups: [...passthrough, advanceIntelligenceSetup(openSetup, thesis, plan, ctx)] };
  }

  // Direction flipped: close the old thesis and open a fresh one in the new direction.
  const closedOld = invalidateVanishedIntelligenceSetup(openSetup, now);
  const fresh = createIntelligenceSetup(symbol, thesis, plan, { ...ctx, origin });
  return { setups: [...passthrough, closedOld, fresh] };
}

/**
 * Applied to symbols that fell out of the dynamic Top-50 universe — no
 * fresh evaluation is possible without live data for them. A still-forming
 * setup gets the normal age-based expiry check. An ACTIVE setup must be
 * force-closed here, not silently left alone: once its symbol drops out of
 * the tracked universe, this app stops fetching that symbol's market data
 * entirely, so an "active" setup would otherwise sit forever showing a
 * frozen, silently-stale price/status — misleading, and (because setups are
 * only ever persisted per-browser) a direct cause of two devices drifting
 * further apart than live evidence differences alone would ever produce: a
 * setup that quietly went dark on one device just keeps being shown there
 * indefinitely while the other device never created it (or already closed
 * it) at all.
 */
export function expireVanishedUniverseSetup(setup: GeneratedSetup, now: number, lastKnownPrice: number | null): GeneratedSetup | null {
  if (!OPEN_SETUP_STATUSES.includes(setup.status)) return null;
  if (setup.status === 'active') {
    return closeOpenSetup(setup, 'expired', 'Symbool viel uit de gevolgde Top-50 universe — live tracking kon niet worden voortgezet.', now, lastKnownPrice);
  }
  return checkExpiry(setup, now);
}
