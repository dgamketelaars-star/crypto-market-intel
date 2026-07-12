import type { Candle } from '../../services/binance/types';
import type { TrendAnalysis, VolumeAnalysis } from '../../analysis/engine/types';
import { calculateObvSeries, calculateObvSlope } from '../../analysis/indicators/obv';
import { categoryEvidence, fact, insufficientData } from '../evidence/build';
import type { CategoryEvidence, EvidenceConclusion } from '../evidence/types';

/**
 * Volume is one Layer B vote: raw/relative volume, spike/trend state and
 * OBV slope all fold into a single conclusion — never counted as separate
 * confirming categories (see the evidence-hierarchy spec's "raw volume,
 * relative volume and OBV remain one Volume conclusion" rule). Volume only
 * gets a direction by leaning on the *price* trend it's accompanying —
 * elevated volume alone is not inherently bullish or bearish.
 */
export function evaluateVolume(volume: VolumeAnalysis | undefined, trend: TrendAnalysis | undefined, candles: Candle[], sourceTimestamp: number): CategoryEvidence {
  if (!volume || !volume.sufficientData) {
    return insufficientData('volume', volume?.timeframe ?? null, sourceTimestamp, ['Insufficient candle history for relative volume.']);
  }

  const obvSeries = calculateObvSeries(candles.map((c) => ({ close: c.close, volume: c.volume })));
  const obvSlope = calculateObvSlope(obvSeries);

  const supporting = [
    fact(`Volume classification: ${volume.classification} (relative volume ${volume.relativeVolume?.toFixed(2) ?? 'n/a'}x).`, volume.timeframe, sourceTimestamp),
  ];
  if (obvSlope !== null) supporting.push(fact(`OBV slope over the last 20 candles: ${obvSlope > 0 ? 'rising' : obvSlope < 0 ? 'falling' : 'flat'}.`, volume.timeframe, sourceTimestamp));

  const priceDirection: 'up' | 'down' | 'flat' =
    trend?.emaSlope20Pct === null || trend?.emaSlope20Pct === undefined ? 'flat' : trend.emaSlope20Pct > 0 ? 'up' : trend.emaSlope20Pct < 0 ? 'down' : 'flat';

  const elevated = volume.classification === 'elevated' || volume.classification === 'spike';
  const obvAgrees = obvSlope === null ? null : (priceDirection === 'up' && obvSlope > 0) || (priceDirection === 'down' && obvSlope < 0);

  let conclusion: EvidenceConclusion = 'neutral';
  if (elevated && priceDirection === 'up') {
    conclusion = obvAgrees !== false ? 'bullish' : 'slightly_bullish';
  } else if (elevated && priceDirection === 'down') {
    conclusion = obvAgrees !== false ? 'bearish' : 'slightly_bearish';
  } else if (!elevated && obvSlope !== null && priceDirection !== 'flat') {
    // Volume itself isn't elevated, but OBV drift alone is a weaker, "slightly" read in the price direction it agrees with.
    if (priceDirection === 'up' && obvSlope > 0) conclusion = 'slightly_bullish';
    if (priceDirection === 'down' && obvSlope < 0) conclusion = 'slightly_bearish';
  }

  return categoryEvidence({ category: 'volume', conclusion, supporting, timeframe: volume.timeframe, sourceTimestamp });
}
