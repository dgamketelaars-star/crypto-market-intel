import { useSyncExternalStore } from 'react';
import { marketDataStore, type SymbolMarketData } from '../store/marketDataStore';
import type { FuturesSymbol } from '../services/binance/types';

/** Live data for one symbol from the dynamic top-20 universe, keyed generically — no hardcoded symbols. */
export function useBinanceMarket(symbol: string): SymbolMarketData | undefined {
  return useSyncExternalStore(marketDataStore.subscribe, () => marketDataStore.getState().bySymbol[symbol]);
}

/** The current dynamically-selected top-20 (+ BTC/ETH) market universe. */
export function useBinanceUniverse(): FuturesSymbol[] {
  return useSyncExternalStore(marketDataStore.subscribe, () => marketDataStore.getState().universe);
}
