import type { GeneratedSetup } from '../engine/types';

/**
 * Isolated persistence contract for generated setups. The live store only
 * talks to this interface — swapping localStorage for a real backend later
 * means implementing this interface, nothing else changes.
 */
export interface SetupPersistenceAdapter {
  load(): GeneratedSetup[];
  save(setups: GeneratedSetup[]): void;
  clear(): void;
}
