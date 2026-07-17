import { advanceSystemCSetup, createSystemCSetup, expireVanishedSystemCSetup, type SystemCSetupState } from './lifecycle/systemCLifecycle';
import { detectLiquiditySweepReversal, type LiquiditySweepCandle } from './signals/liquiditySweepReversal';

/** Our own choice: enough candles for a handful of real swing points plus a 4-point structure sequence to form. */
const MIN_CANDLES = 30;

export interface OrchestrateSystemCInput {
  symbol: string;
  price: number;
  /** This baseline reads 1h candles, same timeframe as System B, for a fair like-for-like comparison. */
  candles1h: LiquiditySweepCandle[];
  now: number;
  existing: SystemCSetupState | null;
  origin: 'live' | 'simulation';
}

/**
 * Pure per-symbol step for System C — same shape as System A's
 * orchestrateSymbol.ts and System B's orchestrateSystemBSymbol.ts, but reads
 * only raw candles and computes an entirely independent structure/liquidity
 * signal. Does not import from src/intelligence/, src/setups/, or
 * src/comparator/open-source-strategy/.
 */
export function orchestrateSystemCSymbol(input: OrchestrateSystemCInput): { setup: SystemCSetupState | null } {
  const { symbol, price, candles1h, now, existing, origin } = input;

  if (existing && (existing.status === 'closed' || existing.status === 'invalidated')) {
    return { setup: existing };
  }

  if (existing) {
    return { setup: advanceSystemCSetup(existing, price, now) };
  }

  if (candles1h.length < MIN_CANDLES) return { setup: null };

  const signal = detectLiquiditySweepReversal(candles1h);
  if (!signal) return { setup: null };

  return { setup: createSystemCSetup(symbol, signal, now, origin) };
}

export { expireVanishedSystemCSetup as expireVanishedSystemCSymbol };
