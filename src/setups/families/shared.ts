import type { Candle } from '../../services/binance/types';
import type { SupportResistanceZone, SymbolAnalysis } from '../../analysis/engine/types';
import type { FamilyReadiness } from '../engine/readiness';
import type { SetupDirection, SetupEvidence, SetupFamily, SetupLevel, SetupTargetCandidate } from '../engine/types';

export interface FamilyEvaluationInput {
  symbol: string;
  price: number;
  analysis: SymbolAnalysis;
  candles1h: Candle[];
  btcAnalysis: SymbolAnalysis | null;
  ethAnalysis: SymbolAnalysis | null;
  now: number;
}

export interface FamilyResult {
  direction: SetupDirection;
  family: SetupFamily;
  readiness: Exclude<FamilyReadiness, 'none'>;
  trigger: SetupLevel;
  invalidation: SetupLevel;
  entryZone: { low: number; high: number } | null;
  /** Raw, defensible price levels — order/portion/status are assigned centrally at activation time. */
  targets: SetupTargetCandidate[];
  supporting: SetupEvidence[];
  opposing: SetupEvidence[];
  missingData: SetupEvidence[];
  /** 1H ATR used for this family's levels — needed for missed-entry detection at activation. */
  atr: number;
}

export interface FamilyDefinition {
  id: SetupFamily;
  label: string;
  documentation: string;
  evaluate: (input: FamilyEvaluationInput) => FamilyResult[] | null;
}

export function last<T>(arr: T[]): T | undefined {
  return arr[arr.length - 1];
}

export function isFinalCandle(candles: Candle[]): boolean {
  const latest = last(candles);
  return latest?.isFinal === true;
}

/**
 * The analysis engine's clustered support/resistance zones are computed
 * relative to the *previous* close, so a zone naturally stops qualifying a
 * candle or two after price has moved decisively past it — by definition,
 * there's no "nearby resistance above price" once price is already above it.
 * For a setup that's already mid-breakout, that's not a broken thesis, it's
 * expected. This falls back to the simple recent swing high/low (one of the
 * spec's own sanctioned trigger inputs) so the setup keeps a usable
 * reference level instead of vanishing the tick after it started moving.
 */
export function resolveZone(
  structureZone: SupportResistanceZone | null,
  candles1h: Candle[],
  side: 'support' | 'resistance',
  options: { lookback?: number; excludeRecent?: number } = {},
): SupportResistanceZone | null {
  if (structureZone) return structureZone;
  const { lookback = 30, excludeRecent = 6 } = options;
  const end = candles1h.length - excludeRecent;
  const start = Math.max(0, end - lookback);
  if (end - start < 5) return null;
  const window = candles1h.slice(start, end);
  const price = side === 'resistance' ? Math.max(...window.map((c) => c.high)) : Math.min(...window.map((c) => c.low));
  return { type: side, price, touches: 1, distancePct: 0 };
}
