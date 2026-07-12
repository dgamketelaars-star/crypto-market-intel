import type { Candle, CandleInterval } from '../../services/binance/types';
import { calculateAtrSeries } from '../indicators/atr';
import { latestMacd, calculateMacdSeries } from '../indicators/macd';
import { latestRoc } from '../indicators/roc';
import { calculateRsiSeries } from '../indicators/rsi';
import { analyseBreakout } from '../structure/breakout';
import { analyseCompression } from '../structure/compression';
import { analyseTrend } from '../structure/trend';
import { buildFreshness } from './freshness';
import { makeIndicatorValue } from './indicatorValue';
import { classifyMomentum, classifyVolatility, RULES } from './rules';
import type {
  DivergenceDirection,
  MarketStructureAnalysis,
  MomentumAnalysis,
  TimeframeAnalysis,
  VolatilityAnalysis,
} from './types';

function lastDataTimestamp(candles: Candle[]): number {
  return candles.length > 0 ? candles[candles.length - 1].closeTime : 0;
}

export function analyseMomentum(candles: Candle[], timeframe: CandleInterval, calculatedAt = Date.now()): MomentumAnalysis {
  const dataTimestamp = lastDataTimestamp(candles);
  const closes = candles.map((c) => c.close);
  const lookback = RULES.momentum.lookback;

  const rsiSeries = calculateRsiSeries(closes, 14);
  const macdSeries = calculateMacdSeries(closes);
  const rsi = rsiSeries[rsiSeries.length - 1] ?? null;
  const macd = latestMacd(closes);
  const roc = latestRoc(closes, 10);

  const rsiSufficient = rsi !== null;
  const macdSufficient = macd !== null;

  const rsiValue = makeIndicatorValue(rsi, timeframe, rsiSufficient, dataTimestamp, calculatedAt);
  const macdValue = makeIndicatorValue(macd, timeframe, macdSufficient, dataTimestamp, calculatedAt);
  const rocValue = makeIndicatorValue(roc, timeframe, roc !== null, dataTimestamp, calculatedAt);

  const pastRsi = rsiSeries.length > lookback ? rsiSeries[rsiSeries.length - 1 - lookback] : null;
  const rsiDelta = rsi !== null && pastRsi !== null ? rsi - pastRsi : null;

  const pastMacd = macdSeries.length > lookback ? macdSeries[macdSeries.length - 1 - lookback] : null;
  const histogramDelta = macd !== null && pastMacd !== null ? macd.histogram - pastMacd.histogram : null;

  const priceRoc = latestRoc(closes, lookback);

  const classification = classifyMomentum({
    rsiDelta,
    histogramDelta,
    priceRoc,
    rsiSufficient,
    macdSufficient,
  });

  const prevHistogram = macdSeries.length > 1 ? macdSeries[macdSeries.length - 2]?.histogram ?? null : null;
  const macdHistogramDirection: MomentumAnalysis['macdHistogramDirection'] =
    macd === null || prevHistogram === null
      ? 'insufficient_data'
      : macd.histogram > prevHistogram
        ? 'rising'
        : macd.histogram < prevHistogram
          ? 'falling'
          : 'flat';

  let divergenceDirection: DivergenceDirection = 'insufficient_data';
  if (classification !== 'insufficient_data') {
    if (classification === 'diverging' && rsiDelta !== null && priceRoc !== null) {
      divergenceDirection =
        priceRoc > 0 && rsiDelta < 0 ? 'bearish_divergence' : priceRoc < 0 && rsiDelta > 0 ? 'bullish_divergence' : 'none';
    } else {
      divergenceDirection = 'none';
    }
  }

  return {
    timeframe,
    classification,
    rsi14: rsiValue,
    macd: macdValue,
    macdHistogramDirection,
    roc: rocValue,
    divergenceDirection,
    freshness: buildFreshness(dataTimestamp, calculatedAt),
    sufficientData: rsiSufficient && macdSufficient,
  };
}

export function analyseVolatility(candles: Candle[], timeframe: CandleInterval, calculatedAt = Date.now()): VolatilityAnalysis {
  const dataTimestamp = lastDataTimestamp(candles);
  const atrSeries = calculateAtrSeries(candles, 14);
  const atr = atrSeries[atrSeries.length - 1] ?? null;
  const lastClose = candles[candles.length - 1]?.close ?? null;

  const atrPct = atr !== null && lastClose ? (atr / lastClose) * 100 : null;
  const atrValue = makeIndicatorValue(atr, timeframe, atr !== null, dataTimestamp, calculatedAt);

  const baselineLookback = RULES.volatility.baselineLookback;
  const atrPctSeries: number[] = [];
  for (let i = 0; i < atrSeries.length; i++) {
    const value = atrSeries[i];
    const close = candles[i]?.close;
    if (value !== null && close) atrPctSeries.push((value / close) * 100);
  }
  const baselineWindow = atrPctSeries.slice(-baselineLookback);
  const atrPctBaseline = baselineWindow.length >= Math.min(baselineLookback, 20)
    ? baselineWindow.reduce((a, b) => a + b, 0) / baselineWindow.length
    : null;

  const lastCandle = candles[candles.length - 1];
  const currentRangePct = lastCandle && lastCandle.close ? ((lastCandle.high - lastCandle.low) / lastCandle.close) * 100 : null;
  const rangeWindow = candles.slice(-20).map((c) => (c.close ? ((c.high - c.low) / c.close) * 100 : null)).filter((v): v is number => v !== null);
  const averageRangePct = rangeWindow.length >= 10 ? rangeWindow.reduce((a, b) => a + b, 0) / rangeWindow.length : null;

  const classification = classifyVolatility(atrPct, atrPctBaseline);

  return {
    timeframe,
    classification,
    atr14: atrValue,
    atrPct,
    atrPctBaseline,
    currentRangePct,
    averageRangePct,
    freshness: buildFreshness(dataTimestamp, calculatedAt),
    sufficientData: atrPct !== null && atrPctBaseline !== null,
  };
}

export function analyseMarketStructure(
  candles: Candle[],
  timeframe: CandleInterval,
  calculatedAt = Date.now(),
): MarketStructureAnalysis {
  const dataTimestamp = lastDataTimestamp(candles);
  const breakout = analyseBreakout(candles);
  const compression = analyseCompression(candles);

  let signal = breakout.signal;
  if (signal === 'none' && compression.sufficientData) {
    if (compression.expansionAfterCompression) signal = 'expansion_after_compression';
    else if (compression.rangeCompression) signal = 'range_compression';
  }

  return {
    timeframe,
    signal,
    nearestSupport: breakout.nearestSupport,
    nearestResistance: breakout.nearestResistance,
    rangeCompression: compression.rangeCompression,
    freshness: buildFreshness(dataTimestamp, calculatedAt),
    sufficientData: breakout.signal !== 'insufficient_data',
  };
}

export function analyseTimeframe(candles: Candle[], timeframe: CandleInterval, calculatedAt = Date.now()): TimeframeAnalysis {
  return {
    timeframe,
    trend: analyseTrend(candles, timeframe, calculatedAt),
    momentum: analyseMomentum(candles, timeframe, calculatedAt),
    volatility: analyseVolatility(candles, timeframe, calculatedAt),
    structure: analyseMarketStructure(candles, timeframe, calculatedAt),
  };
}
