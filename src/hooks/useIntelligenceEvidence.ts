import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { analysisStore } from '../analysis/engine/analysisStore';
import { synthesizeEvidence, type EvidenceSynthesisResult } from '../intelligence/evidence/synthesize';
import { computeBreadthBullishSharePct } from '../intelligence/marketBreadth';
import { planTrade } from '../intelligence/trade-planning/planTrade';
import type { TradePlanResult } from '../intelligence/trade-planning/types';
import { decideThesis } from '../intelligence/thesis/decisionFlow';
import type { ThesisResult } from '../intelligence/thesis/types';
import { marketDataStore } from '../store/marketDataStore';

export interface IntelligencePipelineResult {
  synthesis: EvidenceSynthesisResult;
  thesis: ThesisResult;
  /** Only computed once the thesis is valid — trade planning never runs against a NO_THESIS (see decisionFlow.ts step 7). */
  plan: TradePlanResult | null;
}

/**
 * Live evidence synthesis + thesis decision + (if valid) trade plan for one
 * symbol, recomputed whenever the underlying market-data or analysis stores
 * change. Only computed for whichever single symbol the debug panel has
 * selected — cheap enough for on-demand use, deliberately not run for the
 * whole universe every tick. Nothing here is wired into setup publication
 * (see src/intelligence/generationStatus.ts) — this is inspection-only.
 */
export function useIntelligenceEvidence(symbol: string): IntelligencePipelineResult | null {
  useEffect(() => {
    marketDataStore.connectConsumer();
    analysisStore.connectConsumer();
    return () => {
      marketDataStore.disconnectConsumer();
      analysisStore.disconnectConsumer();
    };
  }, []);

  const marketState = useSyncExternalStore(marketDataStore.subscribe, marketDataStore.getState);
  const analysisState = useSyncExternalStore(analysisStore.subscribe, analysisStore.getState);

  return useMemo(() => {
    const symbolMarket = marketState.bySymbol[symbol];
    const analysis = analysisState.bySymbol[symbol];
    if (!symbolMarket?.ticker || !analysis) return null;

    const now = Date.now();
    const synthesis = synthesizeEvidence({
      symbol,
      analysis,
      candles: symbolMarket.candles,
      price: symbolMarket.ticker.lastPrice,
      markPrice: symbolMarket.markPrice?.markPrice ?? null,
      btcAnalysis: analysisState.bySymbol.BTCUSDT ?? null,
      ethAnalysis: analysisState.bySymbol.ETHUSDT ?? null,
      breadthBullishSharePct: computeBreadthBullishSharePct(analysisState.bySymbol),
      recentLiquidations: symbolMarket.recentLiquidations,
      longShortRatio: symbolMarket.longShortRatio ?? null,
      now,
    });

    const thesis = decideThesis(symbol, synthesis);

    let plan: TradePlanResult | null = null;
    if (thesis.outcome !== 'NO_THESIS') {
      const timeframe4h = analysis.timeframes['4h'];
      const timeframe1h = analysis.timeframes['1h'];
      plan = planTrade({
        direction: thesis.direction,
        price: symbolMarket.ticker.lastPrice,
        candles1h: symbolMarket.candles['1h'] ?? [],
        candles4h: symbolMarket.candles['4h'] ?? [],
        atr1h: timeframe1h?.volatility.atr14.value ?? null,
        atr4h: timeframe4h?.volatility.atr14.value ?? null,
        volatility4h: timeframe4h?.volatility.classification ?? 'insufficient_data',
        derivativesEvidence: synthesis.layers.layerC.derivativesPositioning,
        btcContextEvidence: synthesis.layers.layerC.btcEthContext,
        quoteVolumeRank: analysis.volume.quoteVolumeRank,
        universeSize: analysis.volume.universeSize,
        priceVsEma200Pct: timeframe4h?.trend.priceVsEma200Pct ?? null,
        recentLiquidations: symbolMarket.recentLiquidations,
        now,
      });
    }

    return { synthesis, thesis, plan };
  }, [symbol, marketState, analysisState]);
}
