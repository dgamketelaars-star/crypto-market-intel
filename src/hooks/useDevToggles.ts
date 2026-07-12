import { useCallback, useSyncExternalStore } from 'react';

const MOCK_SETUPS_KEY = 'crypto-market-intel:dev:show-mock-setups';
const SIMULATION_PANEL_KEY = 'crypto-market-intel:dev:show-simulation-panel';
const SETUP_DEBUG_PANEL_KEY = 'crypto-market-intel:dev:show-setup-debug-panel';
const INTELLIGENCE_DEBUG_PANEL_KEY = 'crypto-market-intel:dev:show-intelligence-debug-panel';

function readBoolean(key: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : raw === 'true';
  } catch {
    return fallback;
  }
}

/**
 * A tiny shared store per toggle key so every component reading the same key
 * sees the same value — plain per-component useState + localStorage would
 * silently desync between sibling components (each has its own state that
 * only reads localStorage once, on mount).
 */
class DevToggleStore {
  private readonly key: string;
  private value: boolean;
  private listeners = new Set<() => void>();

  constructor(key: string, defaultValue: boolean) {
    this.key = key;
    this.value = readBoolean(key, defaultValue);
  }

  getValue = (): boolean => this.value;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  set = (next: boolean): void => {
    this.value = next;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(this.key, String(next));
      } catch {
        // ignore write failures (e.g. private browsing storage limits)
      }
    }
    this.listeners.forEach((listener) => listener());
  };
}

/** Mock SOL/DOGE prototype cards default to OFF once the real setup engine produces results. */
const mockSetupsStore = new DevToggleStore(MOCK_SETUPS_KEY, false);
const simulationPanelStore = new DevToggleStore(SIMULATION_PANEL_KEY, false);
const setupDebugPanelStore = new DevToggleStore(SETUP_DEBUG_PANEL_KEY, false);
const intelligenceDebugPanelStore = new DevToggleStore(INTELLIGENCE_DEBUG_PANEL_KEY, false);

function useDevToggle(store: DevToggleStore): [boolean, (next: boolean) => void] {
  const value = useSyncExternalStore(store.subscribe, store.getValue);
  const set = useCallback((next: boolean) => store.set(next), [store]);
  return [value, set];
}

export function useShowMockSetups(): [boolean, (next: boolean) => void] {
  return useDevToggle(mockSetupsStore);
}

export function useShowSimulationPanel(): [boolean, (next: boolean) => void] {
  return useDevToggle(simulationPanelStore);
}

/** Gates the internal setup-engine state panel (hidden candidates + per-symbol conflict-resolution reasoning) — off by default, dev/debug use only. */
export function useShowSetupDebugPanel(): [boolean, (next: boolean) => void] {
  return useDevToggle(setupDebugPanelStore);
}

/** Gates the intelligence-layer evidence panel (regime/structure/evidence synthesis per symbol) — off by default, dev/debug use only. */
export function useShowIntelligenceDebugPanel(): [boolean, (next: boolean) => void] {
  return useDevToggle(intelligenceDebugPanelStore);
}
