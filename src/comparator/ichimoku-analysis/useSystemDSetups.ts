import { useEffect, useSyncExternalStore } from 'react';
import { systemDStore } from './store/systemDStore';
import type { SystemDSetupState } from './lifecycle/systemDLifecycle';

export function useSystemDSetups(): SystemDSetupState[] {
  useEffect(() => {
    systemDStore.connectConsumer();
    return () => systemDStore.disconnectConsumer();
  }, []);

  const setups = useSyncExternalStore(systemDStore.subscribe, () => systemDStore.getState().setups);
  return Object.values(setups);
}
