import type { FundingSample, OiSample } from '../engine/historyBuffer';
import { buildFreshness } from '../engine/freshness';
import { RULES, classifyOpenInterestTrend } from '../engine/rules';
import type { PositioningAnalysis } from '../engine/types';
import { analyseFunding } from './funding';
import { calculateOiChange } from './openInterest';

export interface PositioningInput {
  fundingRate: number | null;
  fundingTime: number | null;
  openInterest: number | null;
  openInterestTime: number | null;
  priceChange24hPct: number | null;
  oiHistory: OiSample[];
  fundingHistory: FundingSample[];
  calculatedAt?: number;
}

export function analysePositioning(input: PositioningInput): PositioningAnalysis {
  const calculatedAt = input.calculatedAt ?? Date.now();
  const dataTimestamp = Math.max(input.fundingTime ?? 0, input.openInterestTime ?? 0);

  const funding = analyseFunding(input.fundingRate, input.fundingHistory);

  const oiChange =
    input.openInterest !== null && input.openInterestTime !== null
      ? calculateOiChange(input.openInterest, input.openInterestTime, input.oiHistory)
      : { change1hPct: null, change4hPct: null, change24hPct: null };

  const oiTrend = classifyOpenInterestTrend(oiChange.change4hPct);

  let priceOiDivergence = false;
  if (input.priceChange24hPct !== null && oiChange.change24hPct !== null) {
    const priceSign = Math.sign(input.priceChange24hPct);
    const oiSign = Math.sign(oiChange.change24hPct);
    const meaningful =
      Math.abs(input.priceChange24hPct) > RULES.openInterest.priceDivergenceThresholdPct &&
      Math.abs(oiChange.change24hPct) > RULES.openInterest.priceDivergenceThresholdPct;
    priceOiDivergence = meaningful && priceSign !== 0 && oiSign !== 0 && priceSign !== oiSign;
  }

  const sufficientData = input.fundingRate !== null || input.openInterest !== null;

  return {
    fundingRate: input.fundingRate,
    fundingState: funding.state,
    fundingVsRecentAvg: funding.vsRecentAvg,
    fundingHistorySamples: funding.historySamples,
    openInterest: input.openInterest,
    oiChange1hPct: oiChange.change1hPct,
    oiChange4hPct: oiChange.change4hPct,
    oiChange24hPct: oiChange.change24hPct,
    oiTrend,
    priceChange24hPct: input.priceChange24hPct,
    priceOiDivergence,
    freshness: buildFreshness(dataTimestamp, calculatedAt),
    sufficientData,
  };
}
