import type { SetupDirection } from '../adapters/normalisedStrategySetup';
import { calculateStopPrice } from '../stops/fixedStop';
import { isTrailingActive, requiredRoiPctAt, roiTargetPrice, trailingStopPrice } from '../targets/roiTrailing';

export type SystemBStatus = 'entry_triggered' | 'active' | 'closed' | 'invalidated';
export type SystemBCloseReason = 'stop' | 'trailing_stop' | 'roi' | 'signal_exit' | 'vanished';

export interface SystemBSetupState {
  id: string;
  symbol: string;
  direction: SetupDirection;
  status: SystemBStatus;
  createdAt: number;
  lastEvaluatedAt: number;
  triggerPrice: number;
  /** Set once status transitions from 'entry_triggered' to 'active'. */
  entryPrice: number | null;
  entryAt: number | null;
  stopPrice: number;
  /** Best price observed since entry, in the position's favour — feeds the trailing stop. */
  peakFavorablePrice: number | null;
  closedAt: number | null;
  closedReason: SystemBCloseReason | null;
  closedPrice: number | null;
  origin: 'live' | 'simulation';
  sourceDataTimestamp: number;
}

export function createTriggeredSetup(
  symbol: string,
  direction: SetupDirection,
  triggerPrice: number,
  now: number,
  origin: 'live' | 'simulation',
): SystemBSetupState {
  return {
    id: `${symbol}-B-${now}`,
    symbol,
    direction,
    status: 'entry_triggered',
    createdAt: now,
    lastEvaluatedAt: now,
    triggerPrice,
    entryPrice: null,
    entryAt: null,
    stopPrice: calculateStopPrice(triggerPrice, direction),
    peakFavorablePrice: null,
    closedAt: null,
    closedReason: null,
    closedPrice: null,
    origin,
    sourceDataTimestamp: now,
  };
}

function unrealizedProfitPct(entryPrice: number, currentPrice: number, direction: SetupDirection): number {
  const raw = (currentPrice - entryPrice) / entryPrice;
  return direction === 'LONG' ? raw : -raw;
}

function updatePeakFavorable(peak: number | null, currentPrice: number, entryPrice: number, direction: SetupDirection): number {
  const base = peak ?? entryPrice;
  if (direction === 'LONG') return Math.max(base, currentPrice);
  return Math.min(base, currentPrice);
}

function close(setup: SystemBSetupState, reason: SystemBCloseReason, price: number, now: number): SystemBSetupState {
  return { ...setup, status: reason === 'vanished' ? 'invalidated' : 'closed', closedAt: now, closedReason: reason, closedPrice: price, lastEvaluatedAt: now };
}

/**
 * Advances one open setup by one candle-close/live-price observation.
 * Exit-condition priority (undocumented upstream execution order — this is
 * our defensible choice, disclosed in metadata/provenance.ts): stop, then
 * trailing stop, then ROI, then signal exit.
 */
export function advanceSystemBSetup(
  setup: SystemBSetupState,
  currentPrice: number,
  now: number,
  signalExitFired: boolean,
): SystemBSetupState {
  if (setup.status === 'entry_triggered') {
    return {
      ...setup,
      status: 'active',
      entryPrice: setup.triggerPrice,
      entryAt: now,
      peakFavorablePrice: setup.triggerPrice,
      lastEvaluatedAt: now,
      sourceDataTimestamp: now,
    };
  }

  if (setup.status !== 'active' || setup.entryPrice === null) {
    return { ...setup, lastEvaluatedAt: now, sourceDataTimestamp: now };
  }

  const entryPrice = setup.entryPrice;
  const direction = setup.direction;

  const stopHit = direction === 'LONG' ? currentPrice <= setup.stopPrice : currentPrice >= setup.stopPrice;
  if (stopHit) return close(setup, 'stop', currentPrice, now);

  const peak = updatePeakFavorable(setup.peakFavorablePrice, currentPrice, entryPrice, direction);
  const profitPct = unrealizedProfitPct(entryPrice, currentPrice, direction);

  if (isTrailingActive(profitPct)) {
    const trailStop = trailingStopPrice(peak, direction);
    const trailingHit = direction === 'LONG' ? currentPrice <= trailStop : currentPrice >= trailStop;
    if (trailingHit) return close(setup, 'trailing_stop', currentPrice, now);
  }

  const elapsedMinutes = (now - (setup.entryAt ?? now)) / 60_000;
  const requiredRoi = requiredRoiPctAt(elapsedMinutes);
  if (profitPct >= requiredRoi) return close(setup, 'roi', currentPrice, now);

  if (signalExitFired) return close(setup, 'signal_exit', currentPrice, now);

  return { ...setup, peakFavorablePrice: peak, lastEvaluatedAt: now, sourceDataTimestamp: now };
}

export function expireVanishedSystemBSetup(setup: SystemBSetupState, now: number, lastKnownPrice: number | null): SystemBSetupState | null {
  if (setup.status === 'closed' || setup.status === 'invalidated') return null;
  return close(setup, 'vanished', lastKnownPrice ?? setup.triggerPrice, now);
}

export { roiTargetPrice };
