import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalStorageSetupPersistence } from '../persistence/localStoragePersistence';
import { makeGeneratedSetup } from '../testUtils/setupFixtures';

class FakeLocalStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
}

/**
 * Mirrors SetupStore.persistAll()'s merge-by-origin strategy without needing
 * a live marketDataStore/analysisStore — proves live and simulation records
 * can share the same persisted array without clobbering each other.
 */
function persistForOrigin(
  persistence: LocalStorageSetupPersistence,
  origin: 'live' | 'simulation',
  setups: ReturnType<typeof makeGeneratedSetup>[],
) {
  const others = persistence.load().filter((s) => s.origin !== origin);
  persistence.save([...others, ...setups]);
}

describe('live/simulation persistence isolation', () => {
  const original = globalThis.window;

  beforeEach(() => {
    // @ts-expect-error minimal window stub for the persistence adapter
    globalThis.window = { localStorage: new FakeLocalStorage() };
  });

  afterEach(() => {
    globalThis.window = original;
  });

  it('does not let a simulation save wipe out live setups', () => {
    const persistence = new LocalStorageSetupPersistence();
    const liveSetup = makeGeneratedSetup({ id: 'live-1', origin: 'live' });
    persistForOrigin(persistence, 'live', [liveSetup]);

    const simSetup = makeGeneratedSetup({ id: 'sim-1', origin: 'simulation' });
    persistForOrigin(persistence, 'simulation', [simSetup]);

    const all = persistence.load();
    expect(all.find((s) => s.id === 'live-1')).toEqual(liveSetup);
    expect(all.find((s) => s.id === 'sim-1')).toEqual(simSetup);
  });

  it('a simulation re-save only replaces its own prior simulation records', () => {
    const persistence = new LocalStorageSetupPersistence();
    const liveSetup = makeGeneratedSetup({ id: 'live-1', origin: 'live' });
    persistForOrigin(persistence, 'live', [liveSetup]);
    persistForOrigin(persistence, 'simulation', [makeGeneratedSetup({ id: 'sim-1', origin: 'simulation' })]);

    // simulation resets and re-runs, producing a fresh record set
    persistForOrigin(persistence, 'simulation', [makeGeneratedSetup({ id: 'sim-2', origin: 'simulation' })]);

    const all = persistence.load();
    expect(all.find((s) => s.id === 'live-1')).toBeDefined();
    expect(all.find((s) => s.id === 'sim-1')).toBeUndefined();
    expect(all.find((s) => s.id === 'sim-2')).toBeDefined();
  });
});
