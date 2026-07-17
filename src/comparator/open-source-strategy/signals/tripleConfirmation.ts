import { calculateSupertrendSeries, type SupertrendCandle, type SupertrendPoint } from '../indicators/supertrend';

/**
 * The exact hyperopt-derived (multiplier, period) pairs baked into upstream
 * FSupertrendStrategy's buy_params / sell_params dicts. These are the values
 * IntParameter.value resolves to when no live hyperopt search is running —
 * i.e. the values that actually apply. See metadata/strategyLimitations.ts:
 * no out-of-sample validation is disclosed for these.
 */
export const BUY_PARAMS = [
  { multiplier: 4, period: 8 },
  { multiplier: 7, period: 9 },
  { multiplier: 1, period: 8 },
] as const;

export const SELL_PARAMS = [
  { multiplier: 1, period: 16 },
  { multiplier: 3, period: 18 },
  { multiplier: 6, period: 18 },
] as const;

export interface TripleConfirmationCandle extends SupertrendCandle {
  volume: number;
}

export interface TripleConfirmationPoint {
  buy: [SupertrendPoint, SupertrendPoint, SupertrendPoint];
  sell: [SupertrendPoint, SupertrendPoint, SupertrendPoint];
  /** All 3 buy-parameter Supertrend instances read "up" on this candle, with volume > 0. */
  enterLong: boolean;
  /** All 3 sell-parameter Supertrend instances read "down" on this candle, with volume > 0. */
  enterShort: boolean;
  /** Middle sell-parameter instance (sell_m2/sell_p2) flips "down" — upstream's exit_long trigger. */
  exitLong: boolean;
  /** Middle buy-parameter instance (buy_m2/buy_p2) flips "up" — upstream's exit_short trigger. */
  exitShort: boolean;
}

export function calculateTripleConfirmationSeries(candles: TripleConfirmationCandle[]): TripleConfirmationPoint[] {
  const buySeries = BUY_PARAMS.map((p) => calculateSupertrendSeries(candles, p.multiplier, p.period));
  const sellSeries = SELL_PARAMS.map((p) => calculateSupertrendSeries(candles, p.multiplier, p.period));

  return candles.map((c, i) => {
    const buy = [buySeries[0][i], buySeries[1][i], buySeries[2][i]] as [SupertrendPoint, SupertrendPoint, SupertrendPoint];
    const sell = [sellSeries[0][i], sellSeries[1][i], sellSeries[2][i]] as [SupertrendPoint, SupertrendPoint, SupertrendPoint];
    const hasVolume = c.volume > 0;

    return {
      buy,
      sell,
      enterLong: hasVolume && buy.every((p) => p.direction === 'up'),
      enterShort: hasVolume && sell.every((p) => p.direction === 'down'),
      exitLong: sell[1].direction === 'down',
      exitShort: buy[1].direction === 'up',
    };
  });
}

export function latestTripleConfirmation(candles: TripleConfirmationCandle[]): TripleConfirmationPoint | null {
  if (candles.length === 0) return null;
  const series = calculateTripleConfirmationSeries(candles);
  return series[series.length - 1];
}
