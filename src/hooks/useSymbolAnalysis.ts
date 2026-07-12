import { useEffect, useSyncExternalStore } from 'react';
import { analysisStore } from '../analysis/engine/analysisStore';
import type { SymbolAnalysis } from '../analysis/engine/types';

/** Calculated (derived) analysis for one symbol — recomputed centrally, not on every render. */
export function useSymbolAnalysis(symbol: string): SymbolAnalysis | undefined {
  useEffect(() => {
    analysisStore.connectConsumer();
    return () => analysisStore.disconnectConsumer();
  }, []);

  return useSyncExternalStore(analysisStore.subscribe, () => analysisStore.getState().bySymbol[symbol]);
}

/** Calculated analysis for the full current universe, keyed by symbol. */
export function useUniverseAnalysis(): Record<string, SymbolAnalysis> {
  useEffect(() => {
    analysisStore.connectConsumer();
    return () => analysisStore.disconnectConsumer();
  }, []);

  return useSyncExternalStore(analysisStore.subscribe, () => analysisStore.getState().bySymbol);
}

export function useAnalysisCalculatedAt(): number | null {
  useEffect(() => {
    analysisStore.connectConsumer();
    return () => analysisStore.disconnectConsumer();
  }, []);

  return useSyncExternalStore(analysisStore.subscribe, () => analysisStore.getState().calculatedAt);
}
