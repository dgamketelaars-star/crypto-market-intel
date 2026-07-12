import type { PositioningAnalysis } from '../../analysis/engine/types';
import { categoryEvidence, fact, insufficientData } from '../evidence/build';
import type { CategoryEvidence, EvidenceConclusion, EvidenceFact } from '../evidence/types';

const PRICE_MOVE_THRESHOLD_PCT = 1;

/**
 * Derivatives is a Layer C context category. It can carry directional
 * flavor (price-vs-OI combinations are genuinely informative), but the
 * thesis decision flow must never use it to *establish* a bias — only to
 * adjust confirmation/strength/risk or veto. Funding is deliberately kept
 * out of the conclusion itself and surfaced only as a crowding-risk
 * annotation: extreme positive funding is a LONG risk factor, never an
 * automatic SHORT signal (and vice versa).
 */
export function evaluateDerivatives(positioning: PositioningAnalysis | undefined, markPrice: number | null, lastPrice: number | null, sourceTimestamp: number): CategoryEvidence {
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
