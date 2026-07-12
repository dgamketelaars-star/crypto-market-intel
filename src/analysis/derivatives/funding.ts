import type { FundingSample } from '../engine/historyBuffer';
import { classifyFundingState } from '../engine/rules';
import type { FundingState } from '../engine/types';

export interface FundingReadResult {
  state: FundingState;
  vsRecentAvg: number | null;
  historySamples: number;
}

export function analyseFunding(currentFundingRate: number | null, history: FundingSample[]): FundingReadResult {
  const rates = history.map((s) => s.fundingRate);
  const state = classifyFundingState({ fundingRate: currentFundingRate, history: rates });

  const vsRecentAvg =
    currentFundingRate !== null && rates.length > 0
      ? currentFundingRate - rates.reduce((a, b) => a + b, 0) / rates.length
      : null;

  return { state, vsRecentAvg, historySamples: rates.length };
}
