import type { CandleInterval } from '../../services/binance/types';
import { SETUP_RULES } from '../engine/rules';
import type { SetupDirection, SetupTargetCandidate } from '../engine/types';
import { calculateRewardToRisk } from './rewardToRisk';

/** Skips (returns null) any target that doesn't clear the minimum documented reward:risk bar. */
function finalizeTarget(
  price: number,
  entry: number,
  invalidation: number,
  direction: SetupDirection,
  timeframe: CandleInterval,
  method: string,
  explanation: string,
): SetupTargetCandidate | null {
  const rewardToRisk = calculateRewardToRisk(entry, price, invalidation, direction);
  if (rewardToRisk === null || rewardToRisk < SETUP_RULES.rewardToRisk.minimum) return null;
  return { price, timeframe, method, explanation, rewardToRisk };
}

export function buildAtrTarget(
  entry: number,
  atr: number,
  multiplier: number,
  direction: SetupDirection,
  invalidation: number,
  timeframe: CandleInterval,
): SetupTargetCandidate | null {
  const price = direction === 'LONG' ? entry + atr * multiplier : entry - atr * multiplier;
  return finalizeTarget(
    price,
    entry,
    invalidation,
    direction,
    timeframe,
    `${multiplier}x ATR(14) vanaf entry`,
    `Conservatief koersdoel op basis van ${multiplier}x de gemiddelde ${timeframe}-volatility (ATR).`,
  );
}

export function buildZoneTarget(
  entry: number,
  zonePrice: number,
  zoneLabel: string,
  direction: SetupDirection,
  invalidation: number,
  timeframe: CandleInterval,
): SetupTargetCandidate | null {
  return finalizeTarget(
    zonePrice,
    entry,
    invalidation,
    direction,
    timeframe,
    `Eerstvolgende ${zoneLabel}-zone`,
    `Het meest voor de hand liggende koersdoel: de eerstvolgende ${zoneLabel}-zone op ${timeframe}.`,
  );
}

export function buildMeasuredMoveTarget(
  entry: number,
  breakLevel: number,
  oppositeLevel: number,
  direction: SetupDirection,
  invalidation: number,
  timeframe: CandleInterval,
): SetupTargetCandidate | null {
  const rangeSize = Math.abs(breakLevel - oppositeLevel);
  if (rangeSize <= 0) return null;
  const price = direction === 'LONG' ? breakLevel + rangeSize : breakLevel - rangeSize;
  return finalizeTarget(
    price,
    entry,
    invalidation,
    direction,
    timeframe,
    'Measured move (breedte vorige range geprojecteerd)',
    'De breedte van de voorafgaande range wordt vanaf de uitbraak geprojecteerd als koersdoel.',
  );
}
