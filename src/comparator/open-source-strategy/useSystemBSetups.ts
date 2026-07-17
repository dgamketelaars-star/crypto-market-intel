import { useEffect, useSyncExternalStore } from 'react';
import { systemBStore } from './store/systemBStore';
import type { SystemBSetupState } from './lifecycle/systemBLifecycle';

export function useSystemBSetups(): SystemBSetupState[] {
  useEffect(() => {
    systemBStore.connectConsumer();
    return () => systemBStore.disconnectConsumer();
  }, []);

  const setups = useSyncExternalStore(systemBStore.subscribe, () => systemBStore.getState().setups);
  return Object.values(setups);
}
