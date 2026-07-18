import { useEffect, useSyncExternalStore } from 'react';
import { systemEStore, type SystemEStoreState } from './store/systemEStore';

export function useSystemEState(): SystemEStoreState {
  useEffect(() => {
    systemEStore.connectConsumer();
    return () => systemEStore.disconnectConsumer();
  }, []);

  return useSyncExternalStore(systemEStore.subscribe, () => systemEStore.getState());
}
