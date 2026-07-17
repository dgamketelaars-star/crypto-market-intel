import type { SystemCSetupState } from '../lifecycle/systemCLifecycle';

const STORAGE_KEY = 'crypto-market-intel:system-c-setups:v1';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function isCompatible(setup: unknown): setup is SystemCSetupState {
  if (typeof setup !== 'object' || setup === null) return false;
  const s = setup as Record<string, unknown>;
  return typeof s.id === 'string' && typeof s.symbol === 'string' && typeof s.direction === 'string' && typeof s.status === 'string';
}

export const systemCPersistence = {
  load(): SystemCSetupState[] {
    if (!isBrowser()) return [];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isCompatible);
    } catch (error) {
      if (import.meta.env.DEV) console.error('[system-c-persistence] failed to load', error);
      return [];
    }
  },
  save(setups: SystemCSetupState[]): void {
    if (!isBrowser()) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(setups));
    } catch (error) {
      if (import.meta.env.DEV) console.error('[system-c-persistence] failed to save', error);
    }
  },
  clear(): void {
    if (!isBrowser()) return;
    window.localStorage.removeItem(STORAGE_KEY);
  },
};
