import type { CandleInterval } from '../../services/binance/types';

export type { CandleInterval };

/** When the underlying data was captured vs. when this result was computed. */
export interface AnalysisFreshness {
  dataTimestamp: number;
  calculatedAt: number;
  stale: boolean;
}

/** A single computed value plus enough metadata to judge whether to trust it. */
export interface IndicatorValue<T> {
  value: T;
  timeframe: CandleInterval;
  sufficientData: boolean;
  dataTimestamp: number;
  calculatedAt: number;
}

export type TrendClassification = 'uptrend' | 'downtrend' | 'sideways' | 'transition' | 'insufficient_data';
export type MomentumClassification = 'strengthening' | 'weakening' | 'neutral' | 'diverging' | 'insufficient_data';
export type VolatilityClassification = 'low' | 'normal' | 'elevated' | 'extreme' | 'insufficient_data';
export type VolumeClassification = 'low' | 'normal' | 'elevated' | 'spike' | 'insufficient_data';
export type SwingPattern =
  | 'higher_highs_higher_lows'
  | 'lower_highs_lower_lows'
  | 'mixed'
  | 'insufficient_data';
export type EmaAlignment = 'bullish' | 'bearish' | 'mixed' | 'insufficient_data';
export type FundingState = 'very_low' | 'low' | 'neutral' | 'elevated' | 'very_elevated' | 'insufficient_data';
export type OpenInterestTrend = 'rising' | 'falling' | 'flat' | 'insufficient_data';
export type StructureSignal =
  | 'breakout_candidate'
  | 'breakdown_candidate'
  | 'failed_breakout'
  | 'range_compression'
  | 'expansion_after_compression'
  | 'none'
  | 'insufficient_data';

export interface MacdPoint {
  macdLine: number;
  signalLine: number;
  histogram: number;
}

export interface TrendAnalysis {
  timeframe: CandleInterval;
  classification: TrendClassification;
  ema20: IndicatorValue<number | null>;
  ema50: IndicatorValue<number | null>;
  ema200: IndicatorValue<number | null>;
  priceVsEma20Pct: number | null;
  priceVsEma50Pct: number | null;
  priceVsEma200Pct: number | null;
  emaAlignment: EmaAlignment;
  /** % change of EMA20 over the slope lookback window — the trend's "speed". */
  emaSlope20Pct: number | null;
  swingPattern: SwingPattern;
  freshness: AnalysisFreshness;
  sufficientData: boolean;
}

export type DivergenceDirection = 'bullish_divergence' | 'bearish_divergence' | 'none' | 'insufficient_data';

export interface MomentumAnalysis {
  timeframe: CandleInterval;
  classification: MomentumClassification;
  rsi14: IndicatorValue<number | null>;
  macd: IndicatorValue<MacdPoint | null>;
  macdHistogramDirection: 'rising' | 'falling' | 'flat' | 'insufficient_data';
  roc: IndicatorValue<number | null>;
  /** Only meaningful when classification === 'diverging'; otherwise 'none'. */
  divergenceDirection: DivergenceDirection;
  freshness: AnalysisFreshness;
  sufficientData: boolean;
}

export interface VolatilityAnalysis {
  timeframe: CandleInterval;
  classification: VolatilityClassification;
  atr14: IndicatorValue<number | null>;
  atrPct: number | null;
  atrPctBaseline: number | null;
  currentRangePct: number | null;
  averageRangePct: number | null;
  freshness: AnalysisFreshness;
  sufficientData: boolean;
}

export interface VolumeAnalysis {
  timeframe: CandleInterval;
  classification: VolumeClassification;
  currentVolume: number | null;
  averageVolume20: number | null;
  relativeVolume: number | null;
  quoteVolumeRank: number | null;
  universeSize: number | null;
  isSpike: boolean;
  freshness: AnalysisFreshness;
  sufficientData: boolean;
}

export interface PositioningAnalysis {
  fundingRate: number | null;
  fundingState: FundingState;
  fundingVsRecentAvg: number | null;
  fundingHistorySamples: number;
  openInterest: number | null;
  oiChange1hPct: number | null;
  oiChange4hPct: number | null;
  oiChange24hPct: number | null;
  oiTrend: OpenInterestTrend;
  priceChange24hPct: number | null;
  /** Price and OI moved in conflicting directions — noteworthy, not directional by itself. */
  priceOiDivergence: boolean;
  freshness: AnalysisFreshness;
  sufficientData: boolean;
}

export interface SupportResistanceZone {
  type: 'support' | 'resistance';
  price: number;
  touches: number;
  distancePct: number;
}

export interface MarketStructureAnalysis {
  timeframe: CandleInterval;
  signal: StructureSignal;
  nearestSupport: SupportResistanceZone | null;
  nearestResistance: SupportResistanceZone | null;
  rangeCompression: boolean;
  freshness: AnalysisFreshness;
  sufficientData: boolean;
}

export interface TimeframeAnalysis {
  timeframe: CandleInterval;
  trend: TrendAnalysis;
  momentum: MomentumAnalysis;
  volatility: VolatilityAnalysis;
  structure: MarketStructureAnalysis;
}

export type AttentionLevel = 'normal' | 'worth_watching' | 'unusual_activity' | 'insufficient_data';

export interface AttentionFeature {
  key: string;
  label: string;
  detail: string;
}

export interface AttentionExplanation {
  level: AttentionLevel;
  headline: string;
  supporting: AttentionFeature[];
  neutral: AttentionFeature[];
  conflicting: AttentionFeature[];
  missingData: AttentionFeature[];
}

export interface SymbolAnalysis {
  symbol: string;
  timeframes: Partial<Record<CandleInterval, TimeframeAnalysis>>;
  /** Primary-timeframe (1h) volume read, including the universe-wide quote-volume rank. */
  volume: VolumeAnalysis;
  positioning: PositioningAnalysis;
  attention: AttentionLevel;
  explanation: AttentionExplanation;
  calculatedAt: number;
  dataTimestamp: number;
}
