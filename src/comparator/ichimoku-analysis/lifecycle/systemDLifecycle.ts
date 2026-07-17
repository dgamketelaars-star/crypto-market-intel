import type { IchimokuDirection } from '../adapters/ichimokuAnalysisSetup';
import type { IchimokuSignal, IchimokuStrength, IchimokuTriggerType } from '../signals/ichimokuSignal';
import { deriveCloudThicknessTarget, isTargetHit } from '../targets/cloudThicknessTarget';
import { deriveIchimokuStop, isStopHit } from '../stops/ichimokuStop';

export type SystemDStatus = 'entry_zone_now' | 'active' | 'closed' | 'invalidated';
export type SystemDCloseReason = 'stop' | 'target' | 'vanished';

export interface SystemDSetupState {
  id: string;
  symbol: string;
  direction: IchimokuDirection;
  status: SystemDStatus;
  strength: IchimokuStrength;
  triggerType: IchimokuTriggerType;
  createdAt: number;
  lastEvaluatedAt: number;
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  targetReason: string;
  kijun: number;
  cloudTop: number;
  cloudBottom: number;
  cloudThicknessPct: number;
  cloudColourAgrees: boolean;
  chikouConfirms: boolean;
  reasons: string[];
  cautions: string[];
  closedAt: number | null;
  closedReason: SystemDCloseReason | null;
  closedPrice: number | null;
  origin: 'live' | 'simulation';
  sourceDataTimestamp: number;
}

export function createSystemDSetup(symbol: string, signal: IchimokuSignal, now: number, origin: 'live' | 'simulation'): SystemDSetupState {
  const stopPrice = deriveIchimokuStop(signal);
  const target = deriveCloudThicknessTarget(signal);

  return {
    id: `${symbol}-D-${now}`,
    symbol,
    direction: signal.direction,
    status: 'entry_zone_now',
    strength: signal.strength,
    triggerType: signal.triggerType,
    createdAt: now,
    lastEvaluatedAt: now,
    entryPrice: signal.entryPrice,
    stopPrice,
    targetPrice: target.price,
    targetReason: target.reason,
    kijun: signal.kijun,
    cloudTop: signal.cloudTop,
    cloudBottom: signal.cloudBottom,
    cloudThicknessPct: signal.cloudThicknessPct,
    cloudColourAgrees: signal.cloudColourAgrees,
    chikouConfirms: signal.chikouConfirms,
    reasons: signal.reasons,
    cautions: signal.cautions,
    closedAt: null,
    closedReason: null,
    closedPrice: null,
    origin,
    sourceDataTimestamp: now,
  };
}

function close(setup: SystemDSetupState, reason: SystemDCloseReason, price: number, now: number): SystemDSetupState {
  return {
    ...setup,
    status: reason === 'target' ? 'closed' : 'invalidated',
    closedAt: now,
    closedReason: reason,
    closedPrice: price,
    lastEvaluatedAt: now,
  };
}

export function advanceSystemDSetup(setup: SystemDSetupState, currentPrice: number, now: number): SystemDSetupState {
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

export function expireVanishedSystemDSetup(setup: SystemDSetupState, now: number, lastKnownPrice: number | null): SystemDSetupState | null {
  if (setup.status === 'closed' || setup.status === 'invalidated') return null;
  return close(setup, 'vanished', lastKnownPrice ?? setup.entryPrice, now);
}
