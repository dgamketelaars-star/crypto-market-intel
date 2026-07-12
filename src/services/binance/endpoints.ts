/**
 * Centralized Binance USDⓈ-M Futures base URLs, REST paths and WebSocket
 * stream-name builders. No other module should hardcode these values.
 *
 * Docs: https://developers.binance.com/docs/derivatives/usds-margined-futures
 */

export const BINANCE_FAPI_BASE_URL = 'https://fapi.binance.com';
export const BINANCE_FSTREAM_BASE_URL = 'wss://fstream.binance.com';

export const REST_ENDPOINTS = {
  exchangeInfo: '/fapi/v1/exchangeInfo',
  ticker24hr: '/fapi/v1/ticker/24hr',
  /** Mark price + funding rate, all symbols when called without `symbol`. */
  premiumIndex: '/fapi/v1/premiumIndex',
  openInterest: '/fapi/v1/openInterest',
  klines: '/fapi/v1/klines',
} as const;

export function klineStreamName(symbol: string, interval: string): string {
  return `${symbol.toLowerCase()}@kline_${interval}`;
}

export function markPriceStreamName(symbol: string): string {
  return `${symbol.toLowerCase()}@markPrice@1s`;
}

export function tickerStreamName(symbol: string): string {
  return `${symbol.toLowerCase()}@ticker`;
}

export function combinedStreamUrl(streams: string[]): string {
  return `${BINANCE_FSTREAM_BASE_URL}/stream?streams=${streams.join('/')}`;
}
