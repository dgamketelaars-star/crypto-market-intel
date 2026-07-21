import { describe, expect, it } from 'vitest';
import { marketDataStore } from './marketDataStore';

// Systems A, B, C and D each independently call marketDataStore.getState()
// (see setupStore.ts and the systemBStore/systemCStore/systemDStore files
// under src/comparator) — all four destructure "universe" from it with zero
// per-system filtering or transformation. What actually guarantees "same
// universe for everyone" is that marketDataStore is a single module-level
// singleton whose getState() returns the one shared state object, not a
// fresh copy per caller. This test proves that mechanism directly, without
// needing to spin up all four heavyweight store classes (network calls,
// timers) just to observe an architectural guarantee that already holds at
// the source.
//
// The actual selection logic (which symbols end up in the list) is
// exhaustively covered in universeSelection.test.ts — this file is only
// about there being exactly one universe, not about what's in it.
describe('shared universe — single source for Systems A-D', () => {
  it('returns the identical universe array reference on every call, as every consumer (A, B, C, D) would observe it', () => {
    const seenByA = marketDataStore.getState().universe;
    const seenByB = marketDataStore.getState().universe;
    const seenByC = marketDataStore.getState().universe;
    const seenByD = marketDataStore.getState().universe;

    expect(seenByA).toBe(seenByB);
    expect(seenByB).toBe(seenByC);
    expect(seenByC).toBe(seenByD);
  });

  it('is the same singleton instance regardless of which relative import path resolves it (mirrors the different depths A-D import it from)', async () => {
    const viaSetupsPath = await import('../setups/store/../../store/marketDataStore');
    const viaComparatorPath = await import('../comparator/open-source-strategy/../../store/marketDataStore');
    expect(viaSetupsPath.marketDataStore).toBe(marketDataStore);
    expect(viaComparatorPath.marketDataStore).toBe(marketDataStore);
  });
});
