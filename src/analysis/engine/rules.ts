import type {
  AttentionLevel,
  FundingState,
  MomentumClassification,
  OpenInterestTrend,
  VolatilityClassification,
  VolumeClassification,
} from './types';

/**
 * Every threshold used by the analysis engine lives here so the rules are
 * auditable and unit-testable in one place, independent of how the data
 * arrived at them.
 */
export const RULES = {
  ema: {
    /** Minimum candles required before an EMA(period) is considered trustworthy. */
    minCandles: (period: number) => period,
    slopeLookback: 10,
  },
  trend: {
    /** EMA20 vs EMA50 within this band (%) is treated as "flat" / sideways. */
    sidewaysBandPct: 0.5,
  },
  momentum: {
    lookback: 5,
    rsiDeltaThreshold: 2,
    rocDivergenceThresholdPct: 1.5,
  },
  volatility: {
    baselineLookback: 50,
    extremeRatio: 2.0,
    elevatedRatio: 1.3,
    lowRatio: 0.6,
  },
  volume: {
    averagePeriod: 20,
    spikeRatio: 3.0,
    elevatedRatio: 1.5,
    lowRatio: 0.5,
  },
  funding: {
    /** Absolute-rate fallback thresholds (as a fraction, e.g. 0.001 = 0.1%) used until enough history exists. */
    veryElevated: 0.001,
    elevated: 0.0003,
    veryLow: -0.001,
    low: -0.0003,
    /** Minimum history samples before switching to the relative (z-score) read. */
    minHistorySamples: 6,
    zElevated: 1,
    zVeryElevated: 2,
  },
  openInterest: {
    /** % change over 4h beyond which OI is considered clearly rising/falling. */
    trendThresholdPct: 2,
    /** Minimum divergence (percentage points) between price and OI change to flag as noteworthy. */
    priceDivergenceThresholdPct: 1,
    /** A "1h/4h/24h ago" sample older than this gap from its target is treated as missing rather than used stale. */
    maxSampleGapMs: 10 * 60_000,
  },
  structure: {
    swingLookback: 2,
    zoneTouchToleragePct: 0.5,
    breakoutBufferPct: 0.15,
    compressionLookback: 20,
    compressionRatio: 0.7,
  },
  attention: {
    worthWatchingMinDeviations: 2,
    unusualActivityMinDeviations: 3,
  },
  freshness: {
    /** Analysis inputs are candle/OI/funding snapshots, not tick data — a wider window than the live-connection staleness check. */
    staleAfterMs: 5 * 60_000,
  },
} as const;

export function classifyMomentum(params: {
  rsiDelta: number | null;
  histogramDelta: number | null;
  priceRoc: number | null;
  rsiSufficient: boolean;
  macdSufficient: boolean;
}): MomentumClassification {
  const { rsiDelta, histogramDelta, priceRoc, rsiSufficient, macdSufficient } = params;
  if (!rsiSufficient || !macdSufficient || rsiDelta === null || histogramDelta === null) {
    return 'insufficient_data';
  }

  if (priceRoc !== null) {
    const priceSign = Math.sign(priceRoc);
    const rsiSign = Math.sign(rsiDelta);
    const meaningfulPriceMove = Math.abs(priceRoc) > RULES.momentum.rocDivergenceThresholdPct;
    const meaningfulRsiMove = Math.abs(rsiDelta) > RULES.momentum.rsiDeltaThreshold;
    if (meaningfulPriceMove && meaningfulRsiMove && priceSign !== 0 && rsiSign !== 0 && priceSign !== rsiSign) {
      return 'diverging';
    }
  }

  if (histogramDelta > 0 && rsiDelta > 0) return 'strengthening';
  if (histogramDelta < 0 && rsiDelta < 0) return 'weakening';
  return 'neutral';
}

export function classifyVolatility(atrPct: number | null, baselineAtrPct: number | null): VolatilityClassification {
  if (atrPct === null || baselineAtrPct === null || baselineAtrPct === 0) return 'insufficient_data';
  const ratio = atrPct / baselineAtrPct;
  if (ratio >= RULES.volatility.extremeRatio) return 'extreme';
  if (ratio >= RULES.volatility.elevatedRatio) return 'elevated';
  if (ratio <= RULES.volatility.lowRatio) return 'low';
  return 'normal';
}

export function classifyVolume(relativeVolume: number | null): VolumeClassification {
  if (relativeVolume === null) return 'insufficient_data';
  if (relativeVolume >= RULES.volume.spikeRatio) return 'spike';
  if (relativeVolume >= RULES.volume.elevatedRatio) return 'elevated';
  if (relativeVolume <= RULES.volume.lowRatio) return 'low';
  return 'normal';
}

export function classifyFundingState(params: {
  fundingRate: number | null;
  history: number[];
}): FundingState {
  const { fundingRate, history } = params;
  if (fundingRate === null) return 'insufficient_data';

  if (history.length >= RULES.funding.minHistorySamples) {
    const mean = history.reduce((a, b) => a + b, 0) / history.length;
    const variance = history.reduce((sum, v) => sum + (v - mean) ** 2, 0) / history.length;
    const stddev = Math.sqrt(variance);
    if (stddev > 0) {
      const z = (fundingRate - mean) / stddev;
      if (z >= RULES.funding.zVeryElevated) return 'very_elevated';
      if (z >= RULES.funding.zElevated) return 'elevated';
      if (z <= -RULES.funding.zVeryElevated) return 'very_low';
      if (z <= -RULES.funding.zElevated) return 'low';
      return 'neutral';
    }
  }

  if (fundingRate >= RULES.funding.veryElevated) return 'very_elevated';
  if (fundingRate >= RULES.funding.elevated) return 'elevated';
  if (fundingRate <= RULES.funding.veryLow) return 'very_low';
  if (fundingRate <= RULES.funding.low) return 'low';
  return 'neutral';
}

export function classifyOpenInterestTrend(change4hPct: number | null): OpenInterestTrend {
  if (change4hPct === null) return 'insufficient_data';
  if (change4hPct > RULES.openInterest.trendThresholdPct) return 'rising';
  if (change4hPct < -RULES.openInterest.trendThresholdPct) return 'falling';
  return 'flat';
}

export interface AttentionDeviation {
  group: string;
  deviates: boolean;
  reason: string;
}

export function classifyAttentionLevel(deviations: AttentionDeviation[], hasSufficientCoreData: boolean): AttentionLevel {
  if (!hasSufficientCoreData) return 'insufficient_data';
  const count = deviations.filter((d) => d.deviates).length;
  if (count >= RULES.attention.unusualActivityMinDeviations) return 'unusual_activity';
  if (count >= RULES.attention.worthWatchingMinDeviations) return 'worth_watching';
  return 'normal';
}
