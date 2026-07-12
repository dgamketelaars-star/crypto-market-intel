import type { AdxPoint } from '../../analysis/indicators/adx';
import type { MarketStructureAnalysis, TrendAnalysis, VolatilityAnalysis } from '../../analysis/engine/types';
import { INTEL_RULES } from '../rules';
import type { MarketRegimeResult } from './types';

export interface ClassifyRegimeInput {
  trend4h: TrendAnalysis | undefined;
  trend1d: TrendAnalysis | undefined;
  volatility4h: VolatilityAnalysis | undefined;
  volatility1d: VolatilityAnalysis | undefined;
  structure4h: MarketStructureAnalysis | undefined;
  structure1d: MarketStructureAnalysis | undefined;
  adx4h: AdxPoint | null;
  adx1d: AdxPoint | null;
}

/**
 * Market regime is read primarily from the daily timeframe (the slowest,
 * least noisy read of "what kind of market is this"), with 4H used as a
 * fallback when 1D doesn't have enough history yet and as a cross-check for
 * the chaotic/conflicted case. This is deliberately independent of the
 * *current structural event* (see src/intelligence/structure/) — regime
 * describes the broad character, structure describes what's happening right
 * now, and the two are allowed to disagree (e.g. a range regime with an
 * active bullish structural breakout).
 */
export function classifyMarketRegime(input: ClassifyRegimeInput): MarketRegimeResult {
  const { trend4h, trend1d, volatility4h, volatility1d, structure4h, structure1d, adx4h, adx1d } = input;
  const reasoning: string[] = [];

  const primary = trend1d?.sufficientData ? trend1d : trend4h?.sufficientData ? trend4h : undefined;
  if (!primary) {
    return { regime: 'insufficient_data', bias: 'neutral', reasoning: ['Neither 1D nor 4H trend has sufficient data.'] };
  }
  reasoning.push(`Primary trend timeframe: ${primary.timeframe} (${primary.classification}).`);

  const volatilityExtreme = volatility1d?.classification === 'extreme' || volatility4h?.classification === 'extreme';

  const bothSufficient = trend1d?.sufficientData && trend4h?.sufficientData;
  const directConflict =
    bothSufficient &&
    ((trend1d!.classification === 'uptrend' && trend4h!.classification === 'downtrend') ||
      (trend1d!.classification === 'downtrend' && trend4h!.classification === 'uptrend'));
  const mixedAlignmentBothTimeframes = trend1d?.emaAlignment === 'mixed' && trend4h?.emaAlignment === 'mixed';

  if ((directConflict && volatilityExtreme) || (mixedAlignmentBothTimeframes && volatilityExtreme)) {
    reasoning.push('1D and 4H trend directly conflict (or both show mixed EMA alignment) while volatility is extreme.');
    return { regime: 'chaotic', bias: 'neutral', reasoning };
  }

  const rangeCompression = structure1d?.rangeCompression || structure4h?.rangeCompression;
  const expansionAfterCompression = structure1d?.signal === 'expansion_after_compression' || structure4h?.signal === 'expansion_after_compression';

  if (expansionAfterCompression) {
    reasoning.push('Range recently compressed and is now expanding again.');
    return { regime: 'expansion', bias: 'neutral', reasoning };
  }
  if (rangeCompression) {
    reasoning.push('Recent range has compressed relative to its own baseline.');
    return { regime: 'compression', bias: 'neutral', reasoning };
  }

  const adx = adx1d ?? adx4h;
  const strongTrend = adx !== null && adx.adx >= INTEL_RULES.regime.adxStrongThreshold;
  if (adx) reasoning.push(`ADX(${adx.adx.toFixed(1)}) on ${adx1d ? '1D' : '4H'} — ${strongTrend ? 'strong' : 'weak/no'} trend strength.`);
  else reasoning.push('ADX unavailable — trend strength defaults to weak.');

  if (primary.classification === 'uptrend') {
    return { regime: strongTrend ? 'strong_uptrend' : 'weak_uptrend', bias: 'bullish', reasoning };
  }
  if (primary.classification === 'downtrend') {
    return { regime: strongTrend ? 'strong_downtrend' : 'weak_downtrend', bias: 'bearish', reasoning };
  }
  if (primary.classification === 'sideways') {
    reasoning.push('Primary trend reads sideways with no active compression/expansion event.');
    return { regime: 'range', bias: 'neutral', reasoning };
  }

  reasoning.push('Primary trend is mid-transition — not yet a clean trend or range read.');
  return { regime: 'transition', bias: 'neutral', reasoning };
}
