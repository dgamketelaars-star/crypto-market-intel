import type {
  MarketStructureAnalysis,
  MomentumAnalysis,
  PositioningAnalysis,
  SupportResistanceZone,
  SymbolAnalysis,
  TimeframeAnalysis,
  TrendAnalysis,
  VolatilityAnalysis,
  VolumeAnalysis,
} from '../../analysis/engine/types';
import type { CandleInterval } from '../../services/binance/types';
import { buildAttentionExplanation } from '../../analysis/explanations/featureExplanations';

const NOW = 1_700_000_000_000;

export function makeZone(price: number, type: 'support' | 'resistance', touches = 2): SupportResistanceZone {
  return { type, price, touches, distancePct: 0 };
}

export function makeTrend(overrides: Partial<TrendAnalysis> = {}, timeframe: CandleInterval = '1h'): TrendAnalysis {
  return {
    timeframe,
    classification: 'uptrend',
    ema20: { value: 100, timeframe, sufficientData: true, dataTimestamp: NOW, calculatedAt: NOW },
    ema50: { value: 95, timeframe, sufficientData: true, dataTimestamp: NOW, calculatedAt: NOW },
    ema200: { value: 85, timeframe, sufficientData: true, dataTimestamp: NOW, calculatedAt: NOW },
    priceVsEma20Pct: 2,
    priceVsEma50Pct: 5,
    priceVsEma200Pct: 15,
    emaAlignment: 'bullish',
    emaSlope20Pct: 1.5,
    swingPattern: 'higher_highs_higher_lows',
    freshness: { dataTimestamp: NOW, calculatedAt: NOW, stale: false },
    sufficientData: true,
    ...overrides,
  };
}

export function makeMomentum(overrides: Partial<MomentumAnalysis> = {}, timeframe: CandleInterval = '1h'): MomentumAnalysis {
  return {
    timeframe,
    classification: 'neutral',
    rsi14: { value: 55, timeframe, sufficientData: true, dataTimestamp: NOW, calculatedAt: NOW },
    macd: {
      value: { macdLine: 0.5, signalLine: 0.3, histogram: 0.2 },
      timeframe,
      sufficientData: true,
      dataTimestamp: NOW,
      calculatedAt: NOW,
    },
    macdHistogramDirection: 'rising',
    roc: { value: 1, timeframe, sufficientData: true, dataTimestamp: NOW, calculatedAt: NOW },
    divergenceDirection: 'none',
    freshness: { dataTimestamp: NOW, calculatedAt: NOW, stale: false },
    sufficientData: true,
    ...overrides,
  };
}

export function makeVolatility(overrides: Partial<VolatilityAnalysis> = {}, timeframe: CandleInterval = '1h'): VolatilityAnalysis {
  return {
    timeframe,
    classification: 'normal',
    atr14: { value: 1, timeframe, sufficientData: true, dataTimestamp: NOW, calculatedAt: NOW },
    atrPct: 1,
    atrPctBaseline: 1,
    currentRangePct: 1,
    averageRangePct: 1,
    freshness: { dataTimestamp: NOW, calculatedAt: NOW, stale: false },
    sufficientData: true,
    ...overrides,
  };
}

export function makeStructure(overrides: Partial<MarketStructureAnalysis> = {}, timeframe: CandleInterval = '1h'): MarketStructureAnalysis {
  return {
    timeframe,
    signal: 'none',
    nearestSupport: makeZone(95, 'support'),
    nearestResistance: makeZone(105, 'resistance'),
    rangeCompression: false,
    freshness: { dataTimestamp: NOW, calculatedAt: NOW, stale: false },
    sufficientData: true,
    ...overrides,
  };
}

export function makeTimeframe(overrides: Partial<TimeframeAnalysis> = {}, timeframe: CandleInterval = '1h'): TimeframeAnalysis {
  return {
    timeframe,
    trend: makeTrend({}, timeframe),
    momentum: makeMomentum({}, timeframe),
    volatility: makeVolatility({}, timeframe),
    structure: makeStructure({}, timeframe),
    ...overrides,
  };
}

export function makeVolume(overrides: Partial<VolumeAnalysis> = {}): VolumeAnalysis {
  return {
    timeframe: '1h',
    classification: 'normal',
    currentVolume: 100,
    averageVolume20: 100,
    relativeVolume: 1,
    quoteVolumeRank: 5,
    universeSize: 20,
    isSpike: false,
    freshness: { dataTimestamp: NOW, calculatedAt: NOW, stale: false },
    sufficientData: true,
    ...overrides,
  };
}

export function makePositioning(overrides: Partial<PositioningAnalysis> = {}): PositioningAnalysis {
  return {
    fundingRate: 0.0001,
    fundingState: 'neutral',
    fundingVsRecentAvg: 0,
    fundingHistorySamples: 10,
    openInterest: 10_000,
    oiChange1hPct: 0.5,
    oiChange4hPct: 1,
    oiChange24hPct: 2,
    oiTrend: 'flat',
    priceChange24hPct: 1,
    priceOiDivergence: false,
    freshness: { dataTimestamp: NOW, calculatedAt: NOW, stale: false },
    sufficientData: true,
    ...overrides,
  };
}

export interface SymbolAnalysisOverrides {
  symbol?: string;
  timeframes?: Partial<Record<CandleInterval, TimeframeAnalysis>>;
  volume?: Partial<VolumeAnalysis>;
  positioning?: Partial<PositioningAnalysis>;
  calculatedAt?: number;
  dataTimestamp?: number;
}

export function makeSymbolAnalysis(overrides: SymbolAnalysisOverrides = {}): SymbolAnalysis {
  const timeframes: Partial<Record<CandleInterval, TimeframeAnalysis>> = {
    '1h': makeTimeframe({}, '1h'),
    '4h': makeTimeframe({}, '4h'),
    '1d': makeTimeframe({}, '1d'),
    ...overrides.timeframes,
  };
  const volume = makeVolume(overrides.volume);
  const positioning = makePositioning(overrides.positioning);

  return {
    symbol: overrides.symbol ?? 'TESTUSDT',
    timeframes,
    volume,
    positioning,
    attention: 'normal',
    explanation: buildAttentionExplanation(overrides.symbol ?? 'TESTUSDT', 'normal', [], [], [], []),
    calculatedAt: overrides.calculatedAt ?? NOW,
    dataTimestamp: overrides.dataTimestamp ?? NOW,
  };
}

export const FIXTURE_NOW = NOW;
