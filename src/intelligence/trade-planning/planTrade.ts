import type { Candle } from '../../services/binance/types';
import type { VolatilityClassification } from '../../analysis/engine/types';
import type { CategoryEvidence } from '../evidence/types';
import type { ThesisDirection } from '../structure/entryLocation';
import { buildEntryZone, isEntryMissed } from './buildEntryZone';
import { buildStopLoss, stopDistanceFloor } from './buildStopLoss';
import { buildTargets } from './buildTargets';
import { calculateRisk } from './calculateRisk';
import { decideTradeHorizon } from './decideHorizon';
import type { TradePlanResult } from './types';

export interface PlanTradeInput {
  direction: ThesisDirection;
  price: number;
  candles1h: Candle[];
  candles4h: Candle[];
  atr1h: number | null;
  atr4h: number | null;
  volatility4h: VolatilityClassification;
  derivativesEvidence: CategoryEvidence;
  btcContextEvidence: CategoryEvidence;
  quoteVolumeRank: number | null;
  universeSize: number | null;
  priceVsEma200Pct: number | null;
}

/**
 * Step 7 of the decision flow: only reached once a VALID thesis already
 * exists (see thesis/decisionFlow.ts) — this module never decides direction,
 * only where to enter, where to invalidate and where to take profit, given
 * a direction that's already been established. Horizon is decided first
 * (decideHorizon.ts), before any price level exists, exactly as the
 * trade-planning spec requires.
 */
export function planTrade(input: PlanTradeInput): TradePlanResult {
  const { direction, price, candles1h, candles4h, atr1h, atr4h, volatility4h, derivativesEvidence, btcContextEvidence, quoteVolumeRank, universeSize, priceVsEma200Pct } = input;

  const horizonDecision = decideTradeHorizon({ direction, candles1h, candles4h, price, atr1h, atr4h });
  if (!horizonDecision) {
    return { outcome: 'NO_PLAN', reason: 'no_structural_stack', detail: 'Neither the 1H/4H day-trade stack nor the 4H/1D swing stack has a defensible zone for this direction right now.' };
  }
  const { horizon, zone, structuralCandles, atr } = horizonDecision;
  const timeframe = horizon === 'DAY_TRADE' ? ('1h' as const) : ('4h' as const);

  const { entryZone, trigger } = buildEntryZone(zone, timeframe);

  if (isEntryMissed(price, entryZone, atr)) {
    return { outcome: 'NO_PLAN', reason: 'entry_missed', detail: `Price has already moved beyond the ${horizon === 'DAY_TRADE' ? '1H' : '4H'} entry zone — do not chase.` };
  }

  const stop = buildStopLoss({ direction, triggerPrice: trigger.price, entryZone, horizon, atr1h, atr4h, timeframe });
  if (!stop) {
    return { outcome: 'NO_PLAN', reason: 'stop_sanity_floor_failed', detail: 'The structural stop distance does not clear the horizon-appropriate ATR sanity floor.' };
  }

  const targets = buildTargets({
    direction,
    triggerPrice: trigger.price,
    invalidationPrice: stop.invalidation.price,
    structuralCandles,
    horizon,
    atr1h,
    atr4h,
    volatility: volatility4h,
    timeframe,
  });
  if (targets.length === 0) {
    return { outcome: 'NO_PLAN', reason: 'no_valid_targets', detail: 'No structural target clears the minimum horizon distance and reward:risk without a degenerate ratio.' };
  }

  const stopFloor = stopDistanceFloor(horizon, atr1h, atr4h) ?? stop.stopDistance;
  const { risk, factors } = calculateRisk({
    direction,
    volatilityClassification: volatility4h,
    stopDistance: stop.stopDistance,
    stopFloor,
    invalidationPrice: stop.invalidation.price,
    derivativesEvidence,
    btcContextEvidence,
    quoteVolumeRank,
    universeSize,
    nearestTargetRewardToRisk: targets[0]?.rewardToRisk ?? null,
    priceVsEma200Pct,
  });

  return {
    outcome: 'VALID_PLAN',
    direction,
    horizon,
    entryZone,
    trigger,
    invalidation: stop.invalidation,
    targets,
    risk,
    riskFactors: factors,
  };
}
