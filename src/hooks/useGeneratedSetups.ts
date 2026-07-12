import { useEffect, useSyncExternalStore } from 'react';
import type { GeneratedSetup } from '../setups/engine/types';
import type { SymbolResolution } from '../setups/engine/conflictResolution';
import { setupStore } from '../setups/store/setupStore';

/** All live-generated setups, keyed by id. Recomputed centrally, not per render. */
export function useGeneratedSetups(): GeneratedSetup[] {
  useEffect(() => {
    setupStore.connectConsumer();
    return () => setupStore.disconnectConsumer();
  }, []);

  const setups = useSyncExternalStore(setupStore.subscribe, () => setupStore.getState().setups);
  return Object.values(setups);
}

export function useSetupStoreLastEvaluatedAt(): number | null {
  useEffect(() => {
    setupStore.connectConsumer();
    return () => setupStore.disconnectConsumer();
  }, []);

  return useSyncExternalStore(setupStore.subscribe, () => setupStore.getState().lastEvaluatedAt);
}

/** True while the setup engine is being rebuilt — see src/intelligence/generationStatus.ts. */
export function useIsSetupGenerationRecalibrating(): boolean {
  useEffect(() => {
    setupStore.connectConsumer();
    return () => setupStore.disconnectConsumer();
  }, []);

  return useSyncExternalStore(setupStore.subscribe, () => setupStore.getState().recalibrating);
}

/** Per-symbol LONG/SHORT conflict-resolution outcome — internal/debug use only, never shown in the normal UI. */
export function useSetupResolutions(): Record<string, SymbolResolution> {
  useEffect(() => {
    setupStore.connectConsumer();
    return () => setupStore.disconnectConsumer();
  }, []);

  return useSyncExternalStore(setupStore.subscribe, () => setupStore.getState().resolutions);
}
