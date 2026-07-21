import type { TrendAnalysis } from '../../analysis/engine/types';
import { categoryEvidence, fact } from '../evidence/build';
import type { CategoryEvidence, EvidenceConclusion } from '../evidence/types';
import { INTEL_RULES } from '../rules';

export interface MarketContextInput {
  symbol: string;
  /** BTC's regime bias — BTC is the primary regime driver for the whole market (see classifyMarketRegime). */
  btcRegimeBias: 'bullish' | 'bearish' | 'neutral';
  /** ETH's own 4H trend — the secondary confirmation layer. */
  ethTrend: TrendAnalysis | undefined;
  /** Fraction of the Top-50 universe (excluding BTC/ETH) whose 4H trend agrees with BTC's bias, or null if unavailable. */
  breadthBullishSharePct: number | null;
  sourceTimestamp: number;
}

/**
 * Market-context is a Layer C category: it never independently creates a
 * LONG/SHORT bias for the *candidate symbol* — it only confirms, contradicts
 * or raises the confirmation bar. BTC leads, ETH confirms, breadth across
 * the Top-50 tells you whether it's a broad move or BTC/ETH-only. A weak or
 * contradicted market context is exactly the situation that should later
 * block an altcoin LONG unless exceptional relative strength is present —
 * that gating decision belongs to the thesis layer, not here; this module
 * only reports the read.
 */
export function evaluateMarketContext(input: MarketContextInput): CategoryEvidence {
  const { symbol, btcRegimeBias, ethTrend, breadthBullishSharePct, sourceTimestamp } = input;

  if (symbol === 'BTCUSDT') {
    return categoryEvidence({
      category: 'btc_eth_context',
      conclusion: 'neutral',
      supporting: [fact('BTC is the primary regime driver itself — market-context evidence is not meaningful for BTC.', 'multi', sourceTimestamp)],
      timeframe: 'multi',
      sourceTimestamp,
    });
  }

  if (btcRegimeBias === 'neutral') {
    return categoryEvidence({
      category: 'btc_eth_context',
      conclusion: 'neutral',
      supporting: [fact('BTC regime carries no directional bias right now.', 'multi', sourceTimestamp)],
      timeframe: 'multi',
      sourceTimestamp,
    });
  }

  const ethAgrees = ethTrend?.sufficientData
    ? btcRegimeBias === 'bullish'
      ? ethTrend.classification === 'uptrend'
      : ethTrend.classification === 'downtrend'
    : null;
  const breadthAgrees =
    breadthBullishSharePct === null
      ? null
      : btcRegimeBias === 'bullish'
        ? breadthBullishSharePct >= INTEL_RULES.marketContext.breadthConfirmMinShare
        : 1 - breadthBullishSharePct >= INTEL_RULES.marketContext.breadthOpposeMinShare;

  const supporting = [fact(`BTC regime bias: ${btcRegimeBias}.`, 'multi', sourceTimestamp)];
  if (ethTrend?.sufficientData) supporting.push(fact(`ETH 4H trend: ${ethTrend.classification} (${ethAgrees ? 'confirms' : 'does not confirm'} BTC).`, '4h', sourceTimestamp));
  if (breadthBullishSharePct !== null) supporting.push(fact(`Top-50 breadth: ${(breadthBullishSharePct * 100).toFixed(0)}% trending with BTC's bias.`, '4h', sourceTimestamp));

  const missingData: string[] = [];
  if (ethAgrees === null) missingData.push('ETH trend unavailable.');
  if (breadthAgrees === null) missingData.push('Breadth across the Top-50 unavailable.');

  const confirmCount = [ethAgrees, breadthAgrees].filter((v) => v === true).length;
  const opposeCount = [ethAgrees, breadthAgrees].filter((v) => v === false).length;

  let conclusion: EvidenceConclusion;
  const fullBias: EvidenceConclusion = btcRegimeBias === 'bullish' ? 'bullish' : 'bearish';
  const slightBias: EvidenceConclusion = btcRegimeBias === 'bullish' ? 'slightly_bullish' : 'slightly_bearish';

  if (confirmCount === 2) conclusion = fullBias;
  else if (opposeCount === 2) {
    conclusion = 'neutral';
    supporting.push(
      fact(
        `Both ETH and Top-50 breadth fail to confirm BTC's ${btcRegimeBias} bias — a weak/contradicted market context, not broad enough to lean on for an altcoin entry without exceptional relative strength.`,
        'multi',
        sourceTimestamp,
      ),
    );
  } else conclusion = slightBias;

  return categoryEvidence({ category: 'btc_eth_context', conclusion, supporting, missingData, timeframe: 'multi', sourceTimestamp });
}
