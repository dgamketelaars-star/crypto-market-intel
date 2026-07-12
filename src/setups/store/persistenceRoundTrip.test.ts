import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalStorageSetupPersistence } from '../persistence/localStoragePersistence';
import { makeGeneratedSetup, makeEntry, makeTarget } from '../testUtils/setupFixtures';
import type { GeneratedSetup } from '../engine/types';

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

/** Mirrors SetupStore.start()'s restore step: load persisted records, keep only this origin's, index by id. */
function restoreForOrigin(persistence: LocalStorageSetupPersistence, origin: 'live' | 'simulation'): Record<string, GeneratedSetup> {
  const restored: Record<string, GeneratedSetup> = {};
  for (const setup of persistence.load()) {
    if (setup.origin === origin) restored[setup.id] = setup;
  }
  return restored;
}

describe('active setup persistence round-trip (survives a page refresh)', () => {
  const original = globalThis.window;

  beforeEach(() => {
    // @ts-expect-error minimal window stub for the persistence adapter
    globalThis.window = { localStorage: new FakeLocalStorage() };
  });

  afterEach(() => {
    globalThis.window = original;
  });

  it('restores an ACTIVE setup with its full entry snapshot and staged targets byte-for-byte', () => {
    const persistence = new LocalStorageSetupPersistence();
    const active = makeGeneratedSetup({
      id: 'active-1',
      status: 'active',
      origin: 'live',
      entry: makeEntry({ activatedAt: 111, triggerPrice: 100, firstLivePrice: 100.5, highestFavorableExcursion: 108, largestAdverseExcursion: 99 }),
      targets: [
        makeTarget({ price: 110, order: 1, positionPortionPct: 60, isFinal: false, status: 'reached' }),
        makeTarget({ price: 120, order: 2, positionPortionPct: 40, isFinal: true, status: 'pending' }),
      ],
    });
    persistence.save([active]);

    const restored = restoreForOrigin(persistence, 'live');
    expect(restored['active-1']).toEqual(active);
    expect(restored['active-1'].entry?.activatedAt).toBe(111);
    expect(restored['active-1'].targets.map((t) => t.status)).toEqual(['reached', 'pending']);
  });

  it('never rewrites the persisted entry timestamp on a plain save/load round-trip', () => {
    const persistence = new LocalStorageSetupPersistence();
    const active = makeGeneratedSetup({ id: 'active-2', status: 'active', origin: 'live', entry: makeEntry({ activatedAt: 12345 }) });
    persistence.save([active]);
    const reloaded = persistence.load().find((s) => s.id === 'active-2');
    expect(reloaded?.entry?.activatedAt).toBe(12345);
  });

  it('only restores setups belonging to the requested origin', () => {
    const persistence = new LocalStorageSetupPersistence();
    const liveActive = makeGeneratedSetup({ id: 'live-active', status: 'active', origin: 'live' });
    const simActive = makeGeneratedSetup({ id: 'sim-active', status: 'active', origin: 'simulation' });
    persistence.save([liveActive, simActive]);

    const restoredLive = restoreForOrigin(persistence, 'live');
    expect(restoredLive['live-active']).toBeDefined();
    expect(restoredLive['sim-active']).toBeUndefined();
  });
});
