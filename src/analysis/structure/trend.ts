import type { Candle, CandleInterval } from '../../services/binance/types';
import { calculateEmaSeries } from '../indicators/ema';
import { buildFreshness } from '../engine/freshness';
import { makeIndicatorValue as indicatorValue } from '../engine/indicatorValue';
import { RULES } from '../engine/rules';
import type { EmaAlignment, TrendAnalysis, TrendClassification } from '../engine/types';
import { classifySwingPattern } from './supportResistance';

function pctDiff(a: number, b: number): number {
  return ((a - b) / b) * 100;
}

export function analyseTrend(candles: Candle[], timeframe: CandleInterval, calculatedAt = Date.now()): TrendAnalysis {
  const dataTimestamp = candles.length > 0 ? candles[candles.length - 1].closeTime : 0;
  const closes = candles.map((c) => c.close);
  const lastClose = closes[closes.length - 1];

  const ema20Series = calculateEmaSeries(closes, 20);
  const ema50Series = calculateEmaSeries(closes, 50);
  const ema200Series = calculateEmaSeries(closes, 200);

  const ema20 = ema20Series[ema20Series.length - 1] ?? null;
  const ema50 = ema50Series[ema50Series.length - 1] ?? null;
  const ema200 = ema200Series[ema200Series.length - 1] ?? null;

  const ema20Value = indicatorValue(ema20, timeframe, ema20 !== null, dataTimestamp, calculatedAt);
  const ema50Value = indicatorValue(ema50, timeframe, ema50 !== null, dataTimestamp, calculatedAt);
  const ema200Value = indicatorValue(ema200, timeframe, ema200 !== null, dataTimestamp, calculatedAt);

  const sufficientData = candles.length > 0 && ema20 !== null && ema50 !== null;

  if (!sufficientData) {
    return {
      timeframe,
      classification: 'insufficient_data',
      ema20: ema20Value,
      ema50: ema50Value,
      ema200: ema200Value,
      priceVsEma20Pct: null,
      priceVsEma50Pct: null,
      priceVsEma200Pct: null,
      emaAlignment: 'insufficient_data',
      emaSlope20Pct: null,
      swingPattern: 'insufficient_data',
      freshness: buildFreshness(dataTimestamp, calculatedAt),
      sufficientData: false,
    };
  }

  const priceVsEma20Pct = pctDiff(lastClose, ema20 as number);
  const priceVsEma50Pct = pctDiff(lastClose, ema50 as number);
  const priceVsEma200Pct = ema200 !== null ? pctDiff(lastClose, ema200) : null;

  let alignment: EmaAlignment;
  if (ema200 !== null) {
    if (ema20! > ema50! && ema50! > ema200) alignment = 'bullish';
    else if (ema20! < ema50! && ema50! < ema200) alignment = 'bearish';
    else alignment = 'mixed';
  } else {
    if (ema20! > ema50!) alignment = 'bullish';
    else if (ema20! < ema50!) alignment = 'bearish';
    else alignment = 'mixed';
  }

  const slopeLookback = RULES.ema.slopeLookback;
  const slopeIndex = ema20Series.length - 1 - slopeLookback;
  const pastEma20 = slopeIndex >= 0 ? ema20Series[slopeIndex] : null;
  const emaSlope20Pct = pastEma20 !== null && pastEma20 !== 0 ? pctDiff(ema20 as number, pastEma20) : null;

  const d2050Pct = Math.abs(pctDiff(ema20 as number, ema50 as number));

  let classification: TrendClassification;
  if (d2050Pct <= RULES.trend.sidewaysBandPct) {
    classification = 'sideways';
  } else if (alignment === 'bullish') {
    classification = emaSlope20Pct === null || emaSlope20Pct >= 0 ? 'uptrend' : 'transition';
  } else if (alignment === 'bearish') {
    classification = emaSlope20Pct === null || emaSlope20Pct <= 0 ? 'downtrend' : 'transition';
  } else {
    classification = 'transition';
  }

  return {
    timeframe,
    classification,
    ema20: ema20Value,
    ema50: ema50Value,
    ema200: ema200Value,
    priceVsEma20Pct,
    priceVsEma50Pct,
    priceVsEma200Pct,
    emaAlignment: alignment,
    emaSlope20Pct,
    swingPattern: classifySwingPattern(candles),
    freshness: buildFreshness(dataTimestamp, calculatedAt),
    sufficientData: true,
  };
}
