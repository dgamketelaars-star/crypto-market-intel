import type { SymbolAnalysis } from '../../analysis/engine/types';
import type { MarketContextAdjustment, SetupDirection } from '../engine/types';

export interface ContextGateResult {
  adjustment: MarketContextAdjustment;
  /** True when readiness should be capped one step below what the pattern alone earned, unless evidence is unusually strong. */
  requireStrongerConfirmation: boolean;
  /** True only for setups that are already ACTIVE — a strong adverse BTC move can invalidate a vulnerable position. */
  forceInvalidate: boolean;
}

const NO_ADJUSTMENT: ContextGateResult = {
  adjustment: { applied: false, reason: 'Geen BTC-contextaanpassing van toepassing.', effect: 'none' },
  requireStrongerConfirmation: false,
  forceInvalidate: false,
};

/**
 * Transparent, deterministic BTC-context influence on non-BTC setups.
 * - BTC itself is never gated by "BTC context".
 * - A SHORT is never auto-approved just because BTC looks weak — only a
 *   strong BTC *uptrend* raises the bar for SHORTs (mirrors the LONG rule).
 * - Only a genuinely strong adverse BTC move can force-invalidate an
 *   already-active vulnerable LONG; everything else only raises the
 *   confirmation bar for new/pending setups.
 */
export function applyMarketContextGate(
  symbol: string,
  direction: SetupDirection,
  btcAnalysis: SymbolAnalysis | null,
): ContextGateResult {
  if (symbol === 'BTCUSDT') return NO_ADJUSTMENT;

  const btc1h = btcAnalysis?.timeframes['1h'];
  const btc4h = btcAnalysis?.timeframes['4h'];
  if (!btc1h || !btc4h || !btc1h.volatility.sufficientData || !btc4h.trend.sufficientData) {
    return {
      adjustment: { applied: false, reason: 'BTC-context heeft onvoldoende data — geen aanpassing toegepast.', effect: 'none' },
      requireStrongerConfirmation: false,
      forceInvalidate: false,
    };
  }

  const btcVolatilityElevated = btc1h.volatility.classification === 'elevated' || btc1h.volatility.classification === 'extreme';
  const btcDowntrend = btc4h.trend.classification === 'downtrend';
  const btcUptrend = btc4h.trend.classification === 'uptrend';
  const btcMomentumWeak = btc1h.momentum.classification === 'weakening';
  const btcOiFalling = btcAnalysis?.positioning.oiTrend === 'falling';
  const btcStrongDownMove = btcDowntrend && (btcMomentumWeak || btcOiFalling) && btcVolatilityElevated;

  if (direction === 'LONG') {
    if (btcStrongDownMove) {
      return {
        adjustment: {
          applied: true,
          reason:
            'BTC toont een sterke neerwaartse beweging (4h downtrend, verzwakkend momentum en/of dalende Open Interest, verhoogde volatility) — dit ondermijnt de LONG-thesis in altcoins.',
          effect: 'invalidated',
        },
        requireStrongerConfirmation: false,
        forceInvalidate: true,
      };
    }
    if (btcDowntrend || btcVolatilityElevated) {
      return {
        adjustment: {
          applied: true,
          reason: `BTC ${btcDowntrend ? 'staat in een downtrend (4h)' : 'volatility is verhoogd (1h)'} — deze LONG vereist sterkere bevestiging voordat hij actief wordt.`,
          effect: 'requires_stronger_confirmation',
        },
        requireStrongerConfirmation: true,
        forceInvalidate: false,
      };
    }
    return NO_ADJUSTMENT;
  }

  // SHORT: never auto-approved just because BTC is weak — only a strong BTC uptrend raises the bar.
  if (btcUptrend) {
    return {
      adjustment: {
        applied: true,
        reason: 'BTC staat in een uptrend (4h) — deze SHORT vereist sterkere bevestiging voordat hij actief wordt.',
        effect: 'requires_stronger_confirmation',
      },
      requireStrongerConfirmation: true,
      forceInvalidate: false,
    };
  }
  if (btcVolatilityElevated) {
    return {
      adjustment: {
        applied: true,
        reason: 'BTC volatility is verhoogd (1h) — deze SHORT vereist sterkere bevestiging voordat hij actief wordt.',
        effect: 'requires_stronger_confirmation',
      },
      requireStrongerConfirmation: true,
      forceInvalidate: false,
    };
  }
  return NO_ADJUSTMENT;
}
