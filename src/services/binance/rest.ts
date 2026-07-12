import { fetchJson } from './client';
import { BINANCE_FAPI_BASE_URL, REST_ENDPOINTS } from './endpoints';
import {
  isEligiblePerpetual,
  normalizeCandleRest,
  normalizeFundingRest,
  normalizeMarkPriceRest,
  normalizeOpenInterestRest,
  normalizeSymbol,
  normalizeTickerRest,
} from './normalizers';
import type { Candle, CandleInterval, FundingData, FuturesSymbol, MarkPriceData, OpenInterestData, TickerData } from './types';

function buildUrl(path: string, params?: Record<string, string | number>): string {
  const target = new URL(path, BINANCE_FAPI_BASE_URL);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      target.searchParams.set(key, String(value));
    }
  }
  return target.toString();
}

/** Active/trading perpetual USDT contracts only — delivery, inactive and non-USDT pairs excluded. */
export async function fetchExchangeInfo(): Promise<FuturesSymbol[]> {
  const data = await fetchJson<{ symbols: unknown[] }>(buildUrl(REST_ENDPOINTS.exchangeInfo));
  if (!Array.isArray(data?.symbols)) {
    throw new Error('Unexpected exchangeInfo response shape');
  }
  return data.symbols.filter(isEligiblePerpetual).map(normalizeSymbol);
}

export async function fetchTicker24hrAll(): Promise<TickerData[]> {
  const data = await fetchJson<unknown[]>(buildUrl(REST_ENDPOINTS.ticker24hr));
  if (!Array.isArray(data)) {
    throw new Error('Unexpected 24hr ticker response shape');
  }
  return data.map(normalizeTickerRest).filter((t) => Number.isFinite(t.lastPrice));
}

export async function fetchPremiumIndexAll(): Promise<{ markPrices: MarkPriceData[]; funding: FundingData[] }> {
  const data = await fetchJson<unknown[]>(buildUrl(REST_ENDPOINTS.premiumIndex));
  if (!Array.isArray(data)) {
    throw new Error('Unexpected premiumIndex response shape');
  }
  return {
    markPrices: data.map(normalizeMarkPriceRest),
    funding: data.map(normalizeFundingRest),
  };
}

export async function fetchOpenInterest(symbol: string): Promise<OpenInterestData> {
  const data = await fetchJson<unknown>(buildUrl(REST_ENDPOINTS.openInterest, { symbol }));
  return normalizeOpenInterestRest(data);
}

export async function fetchKlines(symbol: string, interval: CandleInterval, limit = 150): Promise<Candle[]> {
  const data = await fetchJson<unknown[]>(buildUrl(REST_ENDPOINTS.klines, { symbol, interval, limit }));
  if (!Array.isArray(data)) {
    throw new Error('Unexpected klines response shape');
  }
  return data.map(normalizeCandleRest);
}
