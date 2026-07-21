import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { systemERecordPersistence } from './systemEPersistence';

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

const RECORDS_STORAGE_KEY = 'crypto-market-intel:system-e-records:v1';

/**
 * Regression test for the "Er gaat iets mis" crash on the System E / Compare
 * tabs: a record saved by the pre-two-phase build had a single `result`
 * field instead of `phase1`/`phase2`. It still satisfied the old, shallow
 * validator (id/symbol/generatedAt only), so it loaded successfully and
 * then crashed the UI the moment something read record.phase2.finalDecision
 * on undefined. The fix is at the persistence boundary: reject anything
 * that doesn't have the current shape instead of loading it and crashing
 * downstream.
 */
describe('systemERecordPersistence — old-schema records', () => {
  const original = globalThis.window;

  beforeEach(() => {
    // @ts-expect-error minimal window stub for the persistence adapter
    globalThis.window = { localStorage: new FakeLocalStorage() };
  });

  afterEach(() => {
    globalThis.window = original;
  });

  it('silently drops a pre-two-phase record (single "result" field, no phase1/phase2) instead of loading it', () => {
    const oldFormatRecord = {
      id: 'BTCUSDT-E-1700000000000',
      symbol: 'BTCUSDT',
      generatedAt: 1_700_000_000_000,
      model: 'claude-opus-4-8',
      selectionReason: 'strong_consensus',
      inputSystemsSnapshot: [],
      result: { finalDecision: 'LONG', confidence: 'medium' }, // old single-phase shape
      usage: { inputTokens: 1, outputTokens: 1, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
    };
    window.localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify([oldFormatRecord]));

    const loaded = systemERecordPersistence.load();
    expect(loaded).toEqual([]);
  });

  it('loads a well-formed current-schema record normally', () => {
    const currentRecord = {
      id: 'ETHUSDT-E-1700000000000',
      symbol: 'ETHUSDT',
      generatedAt: 1_700_000_000_000,
      provider: 'anthropic',
      model: 'claude-opus-4-8',
      triggerType: 'manual',
      selectionReason: null,
      inputSystemsSnapshot: [],
      phase1: { decision: 'LONG', setupQuality: 'B' },
      phase2: { finalDecision: 'LONG', finalSetupQuality: 'B', finalConfidence: 'medium' },
      phase1Usage: { inputTokens: 1, outputTokens: 1, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
      phase2Usage: { inputTokens: 1, outputTokens: 1, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
    };
    window.localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify([currentRecord]));

    const loaded = systemERecordPersistence.load();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].symbol).toBe('ETHUSDT');
  });

  it('drops a record with a null phase2 (defensive against a partially-written/corrupted entry)', () => {
    const corrupted = {
      id: 'SOLUSDT-E-1700000000000',
      symbol: 'SOLUSDT',
      generatedAt: 1_700_000_000_000,
      phase1: { decision: 'LONG' },
      phase2: null,
    };
    window.localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify([corrupted]));

    expect(systemERecordPersistence.load()).toEqual([]);
  });

  it('keeps well-formed records and drops only the incompatible ones from a mixed list', () => {
    const oldFormat = { id: 'A-1', symbol: 'AUSDT', generatedAt: 1, result: {} };
    const current = { id: 'B-1', symbol: 'BUSDT', generatedAt: 2, phase1: {}, phase2: {} };
    window.localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify([oldFormat, current]));

    const loaded = systemERecordPersistence.load();
    expect(loaded.map((r) => r.symbol)).toEqual(['BUSDT']);
  });
});
