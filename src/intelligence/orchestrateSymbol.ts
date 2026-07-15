import type { SymbolAnalysis } from '../analysis/engine/types';
import type { Candle, CandleInterval, LiquidationEvent, LongShortRatioData } from '../services/binance/types';
import type { GeneratedSetup } from '../setups/engine/types';
import { OPEN_SETUP_STATUSES } from '../setups/engine/types';
import { checkExpiry } from '../setups/lifecycle/lifecycle';
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

/** Applied to symbols that fell out of the dynamic universe — only expiry, no fresh evaluation possible without live data. */
export function expireVanishedUniverseSetup(setup: GeneratedSetup, now: number): GeneratedSetup | null {
  if (!OPEN_SETUP_STATUSES.includes(setup.status) || setup.status === 'active') return null;
  return checkExpiry(setup, now);
}
