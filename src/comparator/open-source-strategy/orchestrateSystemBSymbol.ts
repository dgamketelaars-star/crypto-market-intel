import { detectEntry } from './entries/detectEntry';
import { detectSignalExit } from './exits/detectExit';
import { advanceSystemBSetup, createTriggeredSetup, expireVanishedSystemBSetup, type SystemBSetupState } from './lifecycle/systemBLifecycle';
import { calculateTripleConfirmationSeries, type TripleConfirmationCandle } from './signals/tripleConfirmation';

export { expireVanishedSystemBSetup as expireVanishedSystemBSymbol };

/** Matches upstream `startup_candle_count = 18` — the max Supertrend period used across buy/sell params. */
const MIN_CANDLES = 19;

export interface OrchestrateSystemBInput {
  symbol: string;
  price: number;
  /** Upstream `timeframe = "1h"`. */
  candles1h: TripleConfirmationCandle[];
  now: number;
  existing: SystemBSetupState | null;
  origin: 'live' | 'simulation';
}

/**
 * Pure per-symbol step for System B, mirroring the shape of
 * src/intelligence/orchestrateSymbol.ts for System A — but computing an
 * entirely independent signal from an entirely independent rule set. Does
 * not read anything from src/intelligence/ or src/setups/.
 */
export function orchestrateSystemBSymbol(input: OrchestrateSystemBInput): { setup: SystemBSetupState | null } {
  const { symbol, price, candles1h, now, existing, origin } = input;

  if (existing && (existing.status === 'closed' || existing.status === 'invalidated')) {
    return { setup: existing };
  }

  if (candles1h.length < MIN_CANDLES) {
    return { setup: existing };
  }

  const series = calculateTripleConfirmationSeries(candles1h);
  const confirmation = series[series.length - 1];

  if (existing) {
    const signalExitFired = detectSignalExit(confirmation, existing.direction);
    return { setup: advanceSystemBSetup(existing, price, now, signalExitFired) };
  }

  const entrySignal = detectEntry(confirmation);
  if (!entrySignal) return { setup: null };

  const triggerCandle = candles1h[candles1h.length - 1];
  return { setup: createTriggeredSetup(symbol, entrySignal, triggerCandle.close, now, origin) };
}
