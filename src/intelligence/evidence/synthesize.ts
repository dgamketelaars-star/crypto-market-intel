import type { SymbolAnalysis } from '../../analysis/engine/types';
import type { Candle, CandleInterval } from '../../services/binance/types';
import { latestAdx } from '../../analysis/indicators/adx';
import { classifyMarketRegime } from '../regime/classifyRegime';
import type { MarketRegime, MarketRegimeResult } from '../regime/types';
import { evaluateEntryLocationQuality } from '../structure/entryLocation';
import { evaluateHtfStructure } from '../structure/htfStructure';
import { evaluateTrend } from '../trend/evaluateTrend';
import { evaluateMomentum } from '../momentum/evaluateMomentum';
import { evaluateVolatility, isExtremeVolatility } from '../volatility/evaluateVolatility';
import { evaluateVolume } from '../volume/evaluateVolume';
import { evaluateDerivatives } from '../derivatives/evaluateDerivatives';
import { evaluateMarketContext } from '../market-context/evaluateMarketContext';
import { deriveLayerABias } from '../thesis/deriveBias';
import { layerAGate, fact } from './build';
import { evaluateRiskConflict } from './evaluateRiskConflict';
import type { EvidenceLayers } from './types';

export interface SynthesizeEvidenceInput {
  symbol: string;
  analysis: SymbolAnalysis;
  candles: Partial<Record<CandleInterval, Candle[]>>;
  price: number;
  markPrice: number | null;
  btcAnalysis: SymbolAnalysis | null;
  ethAnalysis: SymbolAnalysis | null;
  breadthBullishSharePct: number | null;
  now: number;
}

export interface EvidenceSynthesisResult {
  layers: EvidenceLayers;
  regime: MarketRegimeResult;
  /** The Layer A working bias (see deriveLayerABias) — the "one directional bias" step 2 of the decision flow establishes. */
  provisionalBias: 'bullish' | 'bearish' | 'neutral';
  layerAConflicted: boolean;
  /** Whether 4H volatility read as 'extreme' — the decision flow's Layer C tightening/veto trigger. */
  volatilityExtreme: boolean;
}

const UNUSABLE_REGIMES: MarketRegime[] = ['chaotic', 'insufficient_data'];

/**
 * Assembles the full evidence picture for one symbol — every category from
 * the evidence-hierarchy spec, gathered independently and combined into
 * exactly one Layer A bias per deriveLayerABias. This is Phase 2's output:
 * a rich, explainable evidence set. It does *not* decide LONG/SHORT/NO
 * THESIS — that is the decision flow's job (src/intelligence/thesis/), run
 * separately on top of this result.
 */
export function synthesizeEvidence(input: SynthesizeEvidenceInput): EvidenceSynthesisResult {
  const { symbol, analysis, candles, price, markPrice, btcAnalysis, ethAnalysis, breadthBullishSharePct, now } = input;

  const candles4h = candles['4h'] ?? [];
  const candles1d = candles['1d'] ?? [];
  const candles1h = candles['1h'] ?? [];
  const timeframe4h = analysis.timeframes['4h'];
  const timeframe1d = analysis.timeframes['1d'];

  const adx4h = candles4h.length > 0 ? latestAdx(candles4h) : null;
  const adx1d = candles1d.length > 0 ? latestAdx(candles1d) : null;

  const regime = classifyMarketRegime({
    trend4h: timeframe4h?.trend,
    trend1d: timeframe1d?.trend,
    volatility4h: timeframe4h?.volatility,
    volatility1d: timeframe1d?.volatility,
    structure4h: timeframe4h?.structure,
    structure1d: timeframe1d?.structure,
    adx4h,
    adx1d,
  });

  const regimeGate = layerAGate({
    category: 'market_regime',
    gateStatus: UNUSABLE_REGIMES.includes(regime.regime) ? 'blocked' : 'usable',
    bias: regime.bias,
    conclusion: regime.bias === 'bullish' ? 'bullish' : regime.bias === 'bearish' ? 'bearish' : regime.regime === 'insufficient_data' ? 'insufficient_data' : 'neutral',
    supporting: regime.reasoning.map((r) => fact(r, 'multi', now)),
    timeframe: 'multi',
    sourceTimestamp: now,
    blockedReason: UNUSABLE_REGIMES.includes(regime.regime) ? `Regime classified as ${regime.regime}.` : null,
  });

  const structureGate = evaluateHtfStructure(candles4h, candles1d, now);

  const { bias: provisionalBias, conflicted: layerAConflicted } = deriveLayerABias(structureGate.bias, regimeGate.bias);

  const atrForEntryLocation = timeframe4h?.volatility.atr14.value ?? null;
  const entryLocationQuality = {
    LONG: evaluateEntryLocationQuality('LONG', candles4h, price, atrForEntryLocation, now),
    SHORT: evaluateEntryLocationQuality('SHORT', candles4h, price, atrForEntryLocation, now),
  };

  const trendEvidence = evaluateTrend(timeframe4h?.trend, candles4h, now);
  const momentumEvidence = evaluateMomentum(timeframe4h?.momentum, candles4h, now);
  const volumeEvidence = evaluateVolume(analysis.volume, timeframe4h?.trend, candles1h.length > 0 ? candles1h : candles4h, now);

  const volatilityEvidence = evaluateVolatility(timeframe4h?.volatility, candles4h, now);
  const derivativesEvidence = evaluateDerivatives(analysis.positioning, markPrice, price, now);
  const marketContextEvidence = evaluateMarketContext({
    symbol,
    btcRegimeBias: btcAnalysis
      ? classifyMarketRegime({
          trend4h: btcAnalysis.timeframes['4h']?.trend,
          trend1d: btcAnalysis.timeframes['1d']?.trend,
          volatility4h: btcAnalysis.timeframes['4h']?.volatility,
          volatility1d: btcAnalysis.timeframes['1d']?.volatility,
          structure4h: btcAnalysis.timeframes['4h']?.structure,
          structure1d: btcAnalysis.timeframes['1d']?.structure,
          adx4h: null,
          adx1d: null,
        }).bias
      : 'neutral',
    ethTrend: ethAnalysis?.timeframes['4h']?.trend,
    breadthBullishSharePct,
    sourceTimestamp: now,
  });

  const volatilityExtreme = isExtremeVolatility(timeframe4h?.volatility);

  const riskConflictEvidence = evaluateRiskConflict({
    bias: provisionalBias === 'bearish' ? 'SHORT' : 'LONG',
    layerBCategories: [trendEvidence, momentumEvidence, volumeEvidence],
    volatilityExtreme,
    sourceTimestamp: now,
  });

  const layers: EvidenceLayers = {
    layerA: {
      marketRegime: regimeGate,
      higherTimeframeStructure: structureGate,
      entryLocationQuality,
    },
    layerB: {
      trend: trendEvidence,
      momentum: momentumEvidence,
      volume: volumeEvidence,
    },
    layerC: {
      volatility: volatilityEvidence,
      derivativesPositioning: derivativesEvidence,
      btcEthContext: marketContextEvidence,
      riskConflict: riskConflictEvidence,
    },
  };

  return { layers, regime, provisionalBias, layerAConflicted, volatilityExtreme };
}
