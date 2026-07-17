import type { IchimokuSignal } from '../signals/ichimokuSignal';

/**
 * Our own assembly. Ichimoku itself has no fixed price-target formula, so
 * rather than fabricate one we use a real, documented Ichimoku practice:
 * projecting the current Kumo's thickness from the entry price in the trade
 * direction as a "measured move" — the cloud is treated as a proxy for the
 * market's own recently-demonstrated volatility/conviction, the same
 * quantity that made it act as support/resistance in the first place.
 */
export function deriveCloudThicknessTarget(signal: IchimokuSignal): { price: number; reason: string } {
  const price = signal.direction === 'LONG' ? signal.entryPrice + signal.cloudThicknessPrice : signal.entryPrice - signal.cloudThicknessPrice;
  return {
    price,
    reason: 'Kumo-dikte geprojecteerd vanaf entry ("measured move") — Ichimoku zelf geeft geen vast koersdoel, dit is gangbare praktijk onder Ichimoku-traders.',
  };
}

export function isTargetHit(currentPrice: number, targetPrice: number, direction: 'LONG' | 'SHORT'): boolean {
  return direction === 'LONG' ? currentPrice >= targetPrice : currentPrice <= targetPrice;
}
