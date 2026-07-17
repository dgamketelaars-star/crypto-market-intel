import { advanceSystemDSetup, createSystemDSetup, expireVanishedSystemDSetup, type SystemDSetupState } from './lifecycle/systemDLifecycle';
import { detectIchimokuSignal } from './signals/ichimokuSignal';
import type { IchimokuCandle } from './indicators/ichimoku';
import { DISPLACEMENT, SENKOU_PERIOD } from './indicators/ichimoku';

/** Enough for the longest window (Senkou, 52) plus the full forward displacement (26) to be fully formed, plus a small buffer for the previous-bar comparison the signal logic needs. */
const MIN_CANDLES = SENKOU_PERIOD + DISPLACEMENT + 10;

export interface OrchestrateSystemDInput {
  symbol: string;
  price: number;
  /** Reads 1h candles, same timeframe as Systems B and C, for a fair like-for-like comparison. */
  candles1h: IchimokuCandle[];
  now: number;
  existing: SystemDSetupState | null;
  origin: 'live' | 'simulation';
}

/**
 * Pure per-symbol step for System D — same shape as System A's
 * orchestrateSymbol.ts, System B's orchestrateSystemBSymbol.ts, and System
 * C's orchestrateSystemCSymbol.ts. Reads only raw candles and computes an
 * entirely independent Ichimoku signal. Does not import from
 * src/intelligence/, src/setups/, src/comparator/open-source-strategy/, or
 * src/comparator/independent-analysis/.
 */
export function orchestrateSystemDSymbol(input: OrchestrateSystemDInput): { setup: SystemDSetupState | null } {
  const { symbol, price, candles1h, now, existing, origin } = input;

  if (existing && (existing.status === 'closed' || existing.status === 'invalidated')) {
    return { setup: existing };
  }

  if (existing) {
    return { setup: advanceSystemDSetup(existing, price, now) };
  }

  if (candles1h.length < MIN_CANDLES) return { setup: null };

  const signal = detectIchimokuSignal(candles1h);
  if (!signal) return { setup: null };

  return { setup: createSystemDSetup(symbol, signal, now, origin) };
}

export { expireVanishedSystemDSetup as expireVanishedSystemDSymbol };
