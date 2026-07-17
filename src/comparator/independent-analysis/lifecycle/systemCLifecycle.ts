import type { IndependentAnalysisDirection } from '../adapters/independentAnalysisSetup';
import type { LiquidityZone } from '../liquidity/liquiditySweeps';
import type { SmcReversalSignal } from '../signals/liquiditySweepReversal';
import { isStopHit } from '../stops/structuralStop';
import { isTargetHit } from '../targets/liquidityTarget';

export type SystemCStatus = 'entry_zone_now' | 'active' | 'closed' | 'invalidated';
export type SystemCCloseReason = 'stop' | 'target' | 'vanished';

export interface SystemCSetupState {
  id: string;
  symbol: string;
  direction: IndependentAnalysisDirection;
  status: SystemCStatus;
  createdAt: number;
  lastEvaluatedAt: number;
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  targetReason: string;
  sweepZone: LiquidityZone;
  confirmingEventLevel: number;
  closedAt: number | null;
  closedReason: SystemCCloseReason | null;
  closedPrice: number | null;
  origin: 'live' | 'simulation';
  sourceDataTimestamp: number;
}

export function createSystemCSetup(symbol: string, signal: SmcReversalSignal, now: number, origin: 'live' | 'simulation'): SystemCSetupState {
  return {
    id: `${symbol}-C-${now}`,
    symbol,
    direction: signal.direction,
    status: 'entry_zone_now',
    createdAt: now,
    lastEvaluatedAt: now,
    entryPrice: signal.entryPrice,
    stopPrice: signal.stopPrice,
    targetPrice: signal.targetPrice,
    targetReason: signal.targetReason,
    sweepZone: signal.sweepZone,
    confirmingEventLevel: signal.confirmingEvent.level,
    closedAt: null,
    closedReason: null,
    closedPrice: null,
    origin,
    sourceDataTimestamp: now,
  };
}

function close(setup: SystemCSetupState, reason: SystemCCloseReason, price: number, now: number): SystemCSetupState {
  return { ...setup, status: reason === 'vanished' ? 'invalidated' : reason === 'stop' ? 'invalidated' : 'closed', closedAt: now, closedReason: reason, closedPrice: price, lastEvaluatedAt: now };
}

export function advanceSystemCSetup(setup: SystemCSetupState, currentPrice: number, now: number): SystemCSetupState {
  if (setup.status === 'entry_zone_now') {
    return { ...setup, status: 'active', lastEvaluatedAt: now, sourceDataTimestamp: now };
  }
  if (setup.status !== 'active') {
    return { ...setup, lastEvaluatedAt: now, sourceDataTimestamp: now };
  }

  if (isStopHit(currentPrice, setup.stopPrice, setup.direction)) return close(setup, 'stop', currentPrice, now);
  if (isTargetHit(currentPrice, setup.targetPrice, setup.direction)) return close(setup, 'target', currentPrice, now);

  return { ...setup, lastEvaluatedAt: now, sourceDataTimestamp: now };
}

export function expireVanishedSystemCSetup(setup: SystemCSetupState, now: number, lastKnownPrice: number | null): SystemCSetupState | null {
  if (setup.status === 'closed' || setup.status === 'invalidated') return null;
  return close(setup, 'vanished', lastKnownPrice ?? setup.entryPrice, now);
}
