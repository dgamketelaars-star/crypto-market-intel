import type { IchimokuDirection, IchimokuSignal } from '../signals/ichimokuSignal';

/**
 * Our own assembly, following classic Ichimoku stop placement practice:
 * a Kijun-anchored trigger (TK cross, Kijun bounce) invalidates if price
 * closes back through the Kijun-sen; a Kumo-breakout trigger invalidates
 * only if price falls back through the FAR edge of the cloud it just broke
 * out of — the near edge would still be "inside the cloud", which is
 * ambiguous, not yet a failed breakout.
 */
export function deriveIchimokuStop(signal: IchimokuSignal): number {
  if (signal.triggerType === 'kumo_breakout') {
    return signal.direction === 'LONG' ? signal.cloudBottom : signal.cloudTop;
  }
  return signal.kijun;
}

export function isStopHit(currentPrice: number, stopPrice: number, direction: IchimokuDirection): boolean {
  return direction === 'LONG' ? currentPrice <= stopPrice : currentPrice >= stopPrice;
}
