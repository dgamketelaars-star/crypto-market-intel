import type { Candle } from '../../services/binance/types';
import type { TrendAnalysis } from '../../analysis/engine/types';
import { calculateEmaSeries } from '../../analysis/indicators/ema';
import { calculateMaCompressionPct } from '../../analysis/indicators/maCompression';
import { categoryEvidence, fact, insufficientData } from '../evidence/build';
import type { CategoryEvidence, EvidenceConclusion } from '../evidence/types';

const TIGHT_COMPRESSION_PCT = 0.015;

/**
 * Trend is one Layer B vote, not three: EMA20/50/100/200 alignment, slope
 * and MA-compression all fold into a single conclusion — never counted as
 * three separate pieces of confirming evidence (see the evidence-hierarchy
 * spec's "EMA20, EMA50 and EMA200 remain one Trend conclusion" rule).
 */
export function evaluateTrend(trend: TrendAnalysis | undefined, candles: Candle[], sourceTimestamp: number): CategoryEvidence {
  if (!trend || !trend.sufficientData) {
    return insufficientData('trend', trend?.timeframe ?? null, sourceTimestamp, ['Insufficient candle history for EMA20/50/200 on this timeframe.']);
  }

  const closes = candles.map((c) => c.close);
  const ema100 = calculateEmaSeries(closes, 100).at(-1) ?? null;
  const maValues = [trend.ema20.value, trend.ema50.value, ema100, trend.ema200.value];
  const compressionPct = calculateMaCompressionPct(maValues, closes.at(-1) ?? 0);
  const isTightlyCompressed = compressionPct !== null && compressionPct < TIGHT_COMPRESSION_PCT;

  const supporting = [
    fact(`EMA alignment: ${trend.emaAlignment}, classification: ${trend.classification}, EMA20 slope: ${trend.emaSlope20Pct?.toFixed(2) ?? 'n/a'}%.`, trend.timeframe, sourceTimestamp),
  ];
  if (isTightlyCompressed) {
    supporting.push(fact(`EMA20/50/100/200 are tightly compressed (${(compressionPct! * 100).toFixed(2)}% of price) — a less committal read.`, trend.timeframe, sourceTimestamp));
  }

  let conclusion: EvidenceConclusion;
  if (trend.emaAlignment === 'bullish' && trend.classification === 'uptrend') {
    conclusion = isTightlyCompressed ? 'slightly_bullish' : 'bullish';
  } else if (trend.emaAlignment === 'bullish' && trend.classification === 'transition') {
    conclusion = 'slightly_bullish';
  } else if (trend.emaAlignment === 'bearish' && trend.classification === 'downtrend') {
    conclusion = isTightlyCompressed ? 'slightly_bearish' : 'bearish';
  } else if (trend.emaAlignment === 'bearish' && trend.classification === 'transition') {
    conclusion = 'slightly_bearish';
  } else {
    conclusion = 'neutral';
  }

  return categoryEvidence({ category: 'trend', conclusion, supporting, timeframe: trend.timeframe, sourceTimestamp });
}
