import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SETUP_RULE_VERSION } from '../engine/rules';
import { makeGeneratedSetup } from '../testUtils/setupFixtures';
import { LocalStorageSetupPersistence } from './localStoragePersistence';

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

describe('LocalStorageSetupPersistence', () => {
  const original = globalThis.window;

  beforeEach(() => {
    // @ts-expect-error minimal window stub for the persistence adapter
    globalThis.window = { localStorage: new FakeLocalStorage() };
  });

  afterEach(() => {
    globalThis.window = original;
  });

  it('returns an empty array when nothing has been saved yet', () => {
    const persistence = new LocalStorageSetupPersistence();
    expect(persistence.load()).toEqual([]);
  });

  it('round-trips saved setups', () => {
    const persistence = new LocalStorageSetupPersistence();
    const setups = [makeGeneratedSetup({ id: 'a' }), makeGeneratedSetup({ id: 'b', status: 'completed' })];
    persistence.save(setups);
    expect(persistence.load()).toEqual(setups);
  });

  it('clear() removes all persisted setups', () => {
    const persistence = new LocalStorageSetupPersistence();
    persistence.save([makeGeneratedSetup()]);
    persistence.clear();
    expect(persistence.load()).toEqual([]);
  });

  it('recovers gracefully from malformed stored JSON instead of throwing', () => {
    const persistence = new LocalStorageSetupPersistence();
    globalThis.window.localStorage.setItem('crypto-market-intel:generated-setups:v1', '{not valid json');
    expect(() => persistence.load()).not.toThrow();
    expect(persistence.load()).toEqual([]);
  });

  it('recovers gracefully when the stored value is not an array', () => {
    const persistence = new LocalStorageSetupPersistence();
    globalThis.window.localStorage.setItem('crypto-market-intel:generated-setups:v1', JSON.stringify({ not: 'an array' }));
    expect(persistence.load()).toEqual([]);
  });

  it('discards setups persisted under an older/incompatible rule version instead of returning malformed data', () => {
    const persistence = new LocalStorageSetupPersistence();
    const current = makeGeneratedSetup({ id: 'current', ruleVersion: SETUP_RULE_VERSION });
    const stale = makeGeneratedSetup({ id: 'stale', ruleVersion: 'setup-rules-v0' });
    globalThis.window.localStorage.setItem('crypto-market-intel:generated-setups:v1', JSON.stringify([current, stale]));
    expect(persistence.load()).toEqual([current]);
  });

  it('discards a record missing ruleVersion entirely (pre-dates the field)', () => {
    const persistence = new LocalStorageSetupPersistence();
    const legacy = { id: 'legacy', symbol: 'LEGACYUSDT', status: 'active' };
    globalThis.window.localStorage.setItem('crypto-market-intel:generated-setups:v1', JSON.stringify([legacy]));
    expect(persistence.load()).toEqual([]);
  });

  it('discards a record with the current ruleVersion but missing tradeHorizon (added mid-version, same failure class as changeLog before it)', () => {
    const persistence = new LocalStorageSetupPersistence();
    const valid = makeGeneratedSetup({ id: 'valid', ruleVersion: SETUP_RULE_VERSION });
    const { tradeHorizon: _tradeHorizon, ...withoutHorizon } = valid;
    const stale = { ...withoutHorizon, id: 'stale', ruleVersion: SETUP_RULE_VERSION };
    globalThis.window.localStorage.setItem('crypto-market-intel:generated-setups:v1', JSON.stringify([valid, stale]));
    expect(persistence.load()).toEqual([valid]);
  });
});
