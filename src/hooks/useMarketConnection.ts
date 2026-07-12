import { useEffect, useSyncExternalStore } from 'react';
import { marketDataStore } from '../store/marketDataStore';
import type { ConnectionState } from '../services/binance/types';

interface MarketConnection {
  connection: ConnectionState;
  lastUpdatedAt: number | null;
  error: string | null;
}

/**
 * Owns the market data connection lifecycle: the store starts on the first
 * mounted consumer and only tears down once the last one unmounts (with a
 * short grace period so it survives React StrictMode's dev double-mount).
 */
export function useMarketConnection(): MarketConnection {
  useEffect(() => {
    marketDataStore.connectConsumer();
    return () => marketDataStore.disconnectConsumer();
  }, []);

  const connection = useSyncExternalStore(marketDataStore.subscribe, () => marketDataStore.getState().connection);
  const lastMessageAt = useSyncExternalStore(marketDataStore.subscribe, () => marketDataStore.getState().lastMessageAt);
  const lastRestSyncAt = useSyncExternalStore(marketDataStore.subscribe, () => marketDataStore.getState().lastRestSyncAt);
  const error = useSyncExternalStore(marketDataStore.subscribe, () => marketDataStore.getState().error);

  const lastUpdatedAt =
    lastMessageAt && lastRestSyncAt ? Math.max(lastMessageAt, lastRestSyncAt) : (lastMessageAt ?? lastRestSyncAt);

  return { connection, lastUpdatedAt, error };
}
