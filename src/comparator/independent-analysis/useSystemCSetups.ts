import { useEffect, useSyncExternalStore } from 'react';
import { systemCStore } from './store/systemCStore';
import type { SystemCSetupState } from './lifecycle/systemCLifecycle';

export function useSystemCSetups(): SystemCSetupState[] {
  useEffect(() => {
    systemCStore.connectConsumer();
    return () => systemCStore.disconnectConsumer();
  }, []);

  const setups = useSyncExternalStore(systemCStore.subscribe, () => systemCStore.getState().setups);
  return Object.values(setups);
}
