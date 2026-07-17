import type { SetupDirection } from '../adapters/normalisedStrategySetup';

/** Upstream `stoploss = -0.265` — reproduced as-is; see metadata/strategyLimitations.ts. */
export const STOPLOSS_PCT = -0.265;

export function calculateStopPrice(entryPrice: number, direction: SetupDirection): number {
  return direction === 'LONG' ? entryPrice * (1 + STOPLOSS_PCT) : entryPrice * (1 - STOPLOSS_PCT);
}
