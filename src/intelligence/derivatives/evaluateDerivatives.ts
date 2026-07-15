import type { PositioningAnalysis } from '../../analysis/engine/types';
import type { LiquidationEvent, LongShortRatioData } from '../../services/binance/types';
import { categoryEvidence, fact, insufficientData } from '../evidence/build';
import type { CategoryEvidence, EvidenceConclusion, EvidenceFact } from '../evidence/types';
import { INTEL_RULES } from '../rules';

const PRICE_MOVE_THRESHOLD_PCT = 1;
const LONG_SHORT_RATIO_CROWDED_HIGH = 2.0;
const LONG_SHORT_RATIO_CROWDED_LOW = 0.5;

interface LiquidationSummary {
  longLiquidationQty: number;
  shortLiquidationQty: number;
}

/** SELL-side liquidations close out longs; BUY-side liquidations close out shorts. */
function summarizeRecentLiquidations(events: LiquidationEvent[], sourceTimestamp: number): LiquidationSummary {
  const cutoff = sourceTimestamp - INTEL_RULES.liquidations.lookbackMs;
  const recent = events.filter((e) => e.time >= cutoff);
  return {
    longLiquidationQty: recent.filter((e) => e.side === 'SELL').reduce((sum, e) => sum + e.quantity, 0),
    shortLiquidationQty: recent.filter((e) => e.side === 'BUY').reduce((sum, e) => sum + e.quantity, 0),
  };
}

/**
 * Derivatives is a Layer C context category. It can carry directional
 * flavor (price-vs-OI combinations are genuinely informative), but the
 * thesis decision flow must never use it to *establish* a bias — only to
 * adjust confirmation/strength/risk or veto. Funding, the long/short account
 * ratio and recent liquidations are all deliberately kept out of the
 * conclusion itself and surfaced only as crowding-risk/confirmation
 * annotations: extreme positive funding or a long-heavy account ratio is a
 * LONG risk factor, never an automatic SHORT signal (and vice versa) —
 * consistent with the evidence-hierarchy spec's veto-rules examples.
 */
export function evaluateDerivatives(
  positioning: PositioningAnalysis | undefined,
  markPrice: number | null,
  lastPrice: number | null,
  recentLiquidations: LiquidationEvent[],
  longShortRatio: LongShortRatioData | null,
  sourceTimestamp: number,
): CategoryEvidence {
  if (!positioning || !positioning.sufficientData) {
    return insufficientData('derivatives_positioning', 'multi', sourceTimestamp, ['Insufficient funding/OI history.']);
  }

  const priceChange = positioning.priceChange24hPct;
  const oiTrend = positioning.oiTrend;
  const supporting = [
    fact(`24H price change: ${priceChange?.toFixed(2) ?? 'n/a'}%, OI trend: ${oiTrend} (4H change ${positioning.oiChange4hPct?.toFixed(2) ?? 'n/a'}%).`, 'multi', sourceTimestamp),
  ];
  const opposing: EvidenceFact[] = [];
  const missingData: string[] = [];

  let conclusion: EvidenceConclusion = 'neutral';
  if (priceChange !== null && oiTrend !== 'insufficient_data') {
    const priceUp = priceChange > PRICE_MOVE_THRESHOLD_PCT;
    const priceDown = priceChange < -PRICE_MOVE_THRESHOLD_PCT;
    if (priceUp && oiTrend === 'rising') {
      conclusion = 'slightly_bullish';
      supporting.push(fact('Price rising with rising OI — reads as new long positioning entering (continuation), not just short covering.', 'multi', sourceTimestamp));
    } else if (priceDown && oiTrend === 'rising') {
      conclusion = 'slightly_bearish';
      supporting.push(fact('Price falling with rising OI — reads as new short positioning entering (continuation), not just long liquidation.', 'multi', sourceTimestamp));
    } else if (priceUp && oiTrend === 'falling') {
      opposing.push(fact('Price rising while OI falls — likely short covering, a weaker/less sustainable form of strength.', 'multi', sourceTimestamp));
    } else if (priceDown && oiTrend === 'falling') {
      opposing.push(fact('Price falling while OI falls — likely long liquidation/capitulation, possibly exhaustion rather than fresh conviction.', 'multi', sourceTimestamp));
    }
  } else {
    missingData.push('Price change or OI trend unavailable.');
  }

  if (conclusion === 'slightly_bullish' && (positioning.fundingState === 'elevated' || positioning.fundingState === 'very_elevated')) {
    opposing.push(fact('Funding is elevated — longs are already crowded, a risk factor for further upside, not a reversal signal by itself.', 'multi', sourceTimestamp));
  }
  if (conclusion === 'slightly_bearish' && (positioning.fundingState === 'low' || positioning.fundingState === 'very_low')) {
    opposing.push(fact('Funding is very low — shorts are already crowded, a risk factor for further downside, not a reversal signal by itself.', 'multi', sourceTimestamp));
  }

  if (longShortRatio !== null) {
    supporting.push(fact(`Top-trader long/short account ratio: ${longShortRatio.longShortRatio.toFixed(2)} (${longShortRatio.longAccountPct.toFixed(0)}% long / ${longShortRatio.shortAccountPct.toFixed(0)}% short).`, 'multi', sourceTimestamp));
    if (conclusion === 'slightly_bullish' && longShortRatio.longShortRatio >= LONG_SHORT_RATIO_CROWDED_HIGH) {
      opposing.push(fact('Top traders are heavily long-skewed — crowded positioning is a risk factor for further upside, not a reversal signal by itself.', 'multi', sourceTimestamp));
    }
    if (conclusion === 'slightly_bearish' && longShortRatio.longShortRatio <= LONG_SHORT_RATIO_CROWDED_LOW) {
      opposing.push(fact('Top traders are heavily short-skewed — crowded positioning is a risk factor for further downside, not a reversal signal by itself.', 'multi', sourceTimestamp));
    }
  } else {
    missingData.push('Top-trader long/short account ratio unavailable.');
  }

  const { longLiquidationQty, shortLiquidationQty } = summarizeRecentLiquidations(recentLiquidations, sourceTimestamp);
  const lookbackMinutes = INTEL_RULES.liquidations.lookbackMs / 60_000;
  if (longLiquidationQty >= INTEL_RULES.liquidations.minClusterQuantity || shortLiquidationQty >= INTEL_RULES.liquidations.minClusterQuantity) {
    supporting.push(
      fact(
        `Recent liquidations (last ${lookbackMinutes}m): ${longLiquidationQty.toFixed(2)} long liquidated, ${shortLiquidationQty.toFixed(2)} short liquidated.`,
        'multi',
        sourceTimestamp,
      ),
    );
    if (longLiquidationQty >= INTEL_RULES.liquidations.minClusterQuantity) {
      const note = fact('Recent long liquidations — forced selling, not necessarily fresh conviction. Confirms weakness if bearish, a fragility risk if bullish.', 'multi', sourceTimestamp);
      if (conclusion === 'slightly_bearish') supporting.push(note);
      else if (conclusion === 'slightly_bullish') opposing.push(note);
    }
    if (shortLiquidationQty >= INTEL_RULES.liquidations.minClusterQuantity) {
      const note = fact('Recent short liquidations — forced covering, not necessarily fresh conviction. Confirms strength if bullish, a fragility risk if bearish.', 'multi', sourceTimestamp);
      if (conclusion === 'slightly_bullish') supporting.push(note);
      else if (conclusion === 'slightly_bearish') opposing.push(note);
    }
  }

  if (markPrice !== null && lastPrice !== null && lastPrice !== 0) {
    const basisPct = ((markPrice - lastPrice) / lastPrice) * 100;
    if (Math.abs(basisPct) > 0.05) {
      supporting.push(fact(`Mark price basis: ${basisPct.toFixed(3)}% vs last price.`, 'multi', sourceTimestamp));
    }
  } else {
    missingData.push('Mark price unavailable.');
  }

  return categoryEvidence({ category: 'derivatives_positioning', conclusion, supporting, opposing, missingData, timeframe: 'multi', sourceTimestamp });
}
