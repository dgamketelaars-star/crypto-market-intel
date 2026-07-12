/** Normalized domain types for Binance USDⓈ-M Futures public market data. */

export interface FuturesSymbol {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
  contractType: string;
  onboardDate?: number;
}

export interface TickerData {
  symbol: string;
  lastPrice: number;
  priceChangePercent: number;
  quoteVolume: number;
  time: number;
}

export interface MarkPriceData {
  symbol: string;
  markPrice: number;
  indexPrice: number;
  time: number;
}

export interface FundingData {
  symbol: string;
  fundingRate: number;
  nextFundingTime: number;
  time: number;
}

export interface OpenInterestData {
  symbol: string;
  openInterest: number;
  time: number;
}

export type CandleInterval = '15m' | '1h' | '4h' | '1d';

export interface Candle {
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** false while the candle is still forming (live WebSocket update). */
  isFinal: boolean;
}

/** Connection health as shown in the UI status bar. */
export type ConnectionState = 'live' | 'reconnecting' | 'delayed' | 'offline';
