import type { CandleInterval } from '../../services/binance/types';
import { applyAtrBuffer } from '../../setups/levels/atrBuffer';
import type { SetupLevel, TradeHorizon } from '../../setups/engine/types';
import { INTEL_RULES } from '../rules';
import type { ThesisDirection } from '../structure/entryLocation';

export function stopDistanceFloor(horizon: TradeHorizon, atr1h: number | null, atr4h: number | null): number | null {
  if (horizon === 'DAY_TRADE') return atr1h !== null ? atr1h * INTEL_RULES.tradePlanning.horizon.dayTrade.minStopAtr1hMult : null;
  return atr4h !== null ? atr4h * INTEL_RULES.tradePlanning.horizon.swingTrade.minStopAtr4hMult : null;
}

export interface StopLossResult {
  invalidation: SetupLevel;
  stopDistance: number;
}

/**
 * Structure-first: the stop sits just beyond the entry zone's far structural
 * edge, plus a small ATR buffer to absorb noise wicks — the buffer is a
 * minor addition, not the primary distance driver. The horizon-appropriate
 * ATR floor is then applied purely as a *sanity check*: if the structural
 * distance doesn't clear it, the plan is rejected outright rather than
 * artificially widening the stop to force a pass (the explicitly banned
 * "stop = entry ± arbitrary ATR multiplier" shortcut).
 */
export function buildStopLoss(params: {
  direction: ThesisDirection;
  triggerPrice: number;
  entryZone: { low: number; high: number };
  horizon: TradeHorizon;
  atr1h: number | null;
  atr4h: number | null;
  timeframe: CandleInterval;
}): StopLossResult | null {
  const { direction, triggerPrice, entryZone, horizon, atr1h, atr4h, timeframe } = params;

  const structuralEdge = direction === 'LONG' ? entryZone.low : entryZone.high;
  const bufferAtr = horizon === 'DAY_TRADE' ? atr1h : atr4h;
  const stopPrice = bufferAtr !== null ? applyAtrBuffer(structuralEdge, bufferAtr, INTEL_RULES.tradePlanning.stopAtrBufferMult, direction) : structuralEdge;

  const floor = stopDistanceFloor(horizon, atr1h, atr4h);
  if (floor === null) return null;

  const stopDistance = Math.abs(triggerPrice - stopPrice);
  if (stopDistance < floor) return null;

  return {
    invalidation: {
      price: stopPrice,
      timeframe,
      method: 'structural-zone-edge-plus-atr-buffer',
      explanation: `Beyond the ${direction === 'LONG' ? 'support' : 'resistance'} zone's far edge (${structuralEdge.toFixed(4)}), plus a small ATR buffer for noise.`,
    },
    stopDistance,
  };
}
