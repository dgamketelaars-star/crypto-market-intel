import type { Candle } from '../../services/binance/types';
import type { MomentumAnalysis } from '../../analysis/engine/types';
import { calculateStochasticSeries } from '../../analysis/indicators/stochastic';
import { categoryEvidence, fact, insufficientData } from '../evidence/build';
import type { CategoryEvidence, EvidenceConclusion, EvidenceFact } from '../evidence/types';
import { calculateWeisWaves } from './weisWave';

/**
 * Momentum is one Layer B vote: RSI, MACD (+ histogram direction), ROC and
 * Stochastic all feed a single conclusion — never counted as separate
 * confirming categories (see the evidence-hierarchy spec's "RSI, MACD and
 * ROC remain one Momentum conclusion" rule). Divergence is the strongest
 * signal this category can carry and dominates the read when present.
 */
export function evaluateMomentum(momentum: MomentumAnalysis | undefined, candles: Candle[], sourceTimestamp: number): CategoryEvidence {
  if (!momentum || !momentum.sufficientData) {
    return insufficientData('momentum', momentum?.timeframe ?? null, sourceTimestamp, ['Insufficient candle history for RSI/MACD on this timeframe.']);
  }

  if (momentum.classification === 'diverging' && momentum.divergenceDirection !== 'none' && momentum.divergenceDirection !== 'insufficient_data') {
    const bullish = momentum.divergenceDirection === 'bullish_divergence';
    return categoryEvidence({
      category: 'momentum',
      conclusion: bullish ? 'slightly_bullish' : 'slightly_bearish',
      supporting: [fact(`${momentum.divergenceDirection.replace('_', ' ')} between price and RSI/MACD.`, momentum.timeframe, sourceTimestamp)],
      opposing: [fact('Divergence is an early reversal warning, not confirmed momentum — kept to a "slightly" read.', momentum.timeframe, sourceTimestamp)],
      timeframe: momentum.timeframe,
      sourceTimestamp,
    });
  }

  const stochastic = calculateStochasticSeries(candles.map((c) => ({ high: c.high, low: c.low, close: c.close }))).at(-1);
  const rsi = momentum.rsi14.value;
  const stochAgrees =
    stochastic !== null && stochastic !== undefined
      ? (momentum.classification === 'strengthening' && stochastic.percentK > 50) || (momentum.classification === 'weakening' && stochastic.percentK < 50)
      : null;

  const supporting = [
    fact(
      `RSI(14): ${rsi?.toFixed(1) ?? 'n/a'}, MACD histogram: ${momentum.macdHistogramDirection}, ROC: ${momentum.roc.value?.toFixed(2) ?? 'n/a'}%.`,
      momentum.timeframe,
      sourceTimestamp,
    ),
  ];
  if (stochastic) supporting.push(fact(`Stochastic %K: ${stochastic.percentK.toFixed(1)}.`, momentum.timeframe, sourceTimestamp));

  let conclusion: EvidenceConclusion;
  if (momentum.classification === 'strengthening') {
    const risingFromAbove50 = rsi !== null && rsi >= 50;
    conclusion = risingFromAbove50 && stochAgrees !== false ? 'bullish' : 'slightly_bullish';
  } else if (momentum.classification === 'weakening') {
    const fallingFromBelow50 = rsi !== null && rsi <= 50;
    conclusion = fallingFromBelow50 && stochAgrees !== false ? 'bearish' : 'slightly_bearish';
  } else {
    conclusion = 'neutral';
  }

  const opposing: EvidenceFact[] = [];
  if (momentum.classification === 'strengthening' || momentum.classification === 'weakening') {
    const weisResult = calculateWeisWaves(candles).latestWaveEffortVsResult;
    if (weisResult !== 'insufficient_data' && weisResult !== 'neutral') {
      const weisFact = fact(`Weis wave analysis: the latest price swing is ${weisResult} (price-progress-per-unit-volume vs. the prior same-direction swing).`, momentum.timeframe, sourceTimestamp);
      if (weisResult === momentum.classification) supporting.push(weisFact);
      else opposing.push(fact(`${weisFact.description} This conflicts with the RSI/MACD-based ${momentum.classification} read.`, momentum.timeframe, sourceTimestamp));
    }
  }

  return categoryEvidence({ category: 'momentum', conclusion, supporting, opposing, timeframe: momentum.timeframe, sourceTimestamp });
}
