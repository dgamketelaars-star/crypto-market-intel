import { describe, expect, it } from 'vitest';
import { resolveSymbolVisibility, selectVisibleSetups } from './visibleSetupSelection';
import { evidence } from './evidence';
import { makeGeneratedSetup } from '../testUtils/setupFixtures';

const ev = (group: Parameters<typeof evidence>[0]) => evidence(group, group, group);

describe('selectVisibleSetups — closed setups never reach the normal UI', () => {
  it('filters out invalidated, completed and expired setups', () => {
    const setups = [
      makeGeneratedSetup({ id: 'a', symbol: 'AUSDT', status: 'invalidated' }),
      makeGeneratedSetup({ id: 'b', symbol: 'BUSDT', status: 'completed' }),
      makeGeneratedSetup({ id: 'c', symbol: 'CUSDT', status: 'expired' }),
    ];
    const { visible } = selectVisibleSetups(setups);
    expect(visible).toEqual([]);
  });

  it('does not mutate or drop the closed records from the input array — only the returned view excludes them', () => {
    const setups = [makeGeneratedSetup({ id: 'a', symbol: 'AUSDT', status: 'completed' })];
    selectVisibleSetups(setups);
    // The caller's array (which mirrors what the store still holds) is untouched.
    expect(setups).toHaveLength(1);
    expect(setups[0].status).toBe('completed');
  });

  it('keeps candidate, waiting_for_confirmation and active setups visible', () => {
    const setups = [
      makeGeneratedSetup({ id: 'a', symbol: 'AUSDT', status: 'candidate' }),
      makeGeneratedSetup({ id: 'b', symbol: 'BUSDT', status: 'waiting_for_confirmation' }),
      makeGeneratedSetup({ id: 'c', symbol: 'CUSDT', status: 'active' }),
    ];
    const { visible } = selectVisibleSetups(setups);
    expect(visible.map((s) => s.id).sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('selectVisibleSetups — at most one visible setup per symbol', () => {
  it('collapses two same-direction setups (different families) for one symbol down to a single visible one', () => {
    const setups = [
      makeGeneratedSetup({ id: 'a', symbol: 'AUSDT', direction: 'LONG', family: 'trend_continuation_breakout', status: 'candidate' }),
      makeGeneratedSetup({ id: 'b', symbol: 'AUSDT', direction: 'LONG', family: 'range_breakout', status: 'candidate' }),
    ];
    const { visible } = selectVisibleSetups(setups);
    expect(visible).toHaveLength(1);
  });

  it('prefers the more advanced status when picking among same-direction candidates', () => {
    const setups = [
      makeGeneratedSetup({ id: 'a', symbol: 'AUSDT', direction: 'LONG', status: 'candidate' }),
      makeGeneratedSetup({ id: 'b', symbol: 'AUSDT', direction: 'LONG', status: 'active' }),
    ];
    const { visible } = selectVisibleSetups(setups);
    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe('b');
  });
});

describe('selectVisibleSetups — never both directions for one symbol', () => {
  it('never returns both a LONG and a SHORT setup for the same symbol', () => {
    const setups = [
      makeGeneratedSetup({
        id: 'long-1',
        symbol: 'AUSDT',
        direction: 'LONG',
        status: 'candidate',
        supporting: [ev('trend'), ev('momentum'), ev('volume')],
        opposing: [],
      }),
      makeGeneratedSetup({
        id: 'short-1',
        symbol: 'AUSDT',
        direction: 'SHORT',
        status: 'candidate',
        supporting: [ev('trend')],
        opposing: [],
      }),
    ];
    const { visible } = selectVisibleSetups(setups);
    const directions = new Set(visible.map((s) => s.direction));
    expect(directions.size).toBeLessThanOrEqual(1);
    expect(visible).toHaveLength(1);
    expect(visible[0].direction).toBe('LONG'); // clear dominance (3 vs 1)
  });
});

describe('selectVisibleSetups — conflicted symbols show nothing', () => {
  it('shows no setup for a symbol when LONG and SHORT are evenly matched', () => {
    const setups = [
      makeGeneratedSetup({
        id: 'long-1',
        symbol: 'AUSDT',
        direction: 'LONG',
        status: 'candidate',
        supporting: [ev('trend'), ev('momentum')],
        opposing: [],
      }),
      makeGeneratedSetup({
        id: 'short-1',
        symbol: 'AUSDT',
        direction: 'SHORT',
        status: 'candidate',
        supporting: [ev('volume'), ev('market_structure')],
        opposing: [],
      }),
    ];
    const { visible, bySymbol } = selectVisibleSetups(setups);
    expect(visible).toEqual([]);
    expect(bySymbol.AUSDT.outcome).toBe('conflicted');
    expect(bySymbol.AUSDT.visible).toBeNull();
  });

  it('leaves other symbols unaffected by one symbol being conflicted', () => {
    const setups = [
      makeGeneratedSetup({ id: 'long-a', symbol: 'AUSDT', direction: 'LONG', status: 'candidate', supporting: [ev('trend')] }),
      makeGeneratedSetup({ id: 'short-a', symbol: 'AUSDT', direction: 'SHORT', status: 'candidate', supporting: [ev('trend')] }),
      makeGeneratedSetup({ id: 'long-b', symbol: 'BUSDT', direction: 'LONG', status: 'active' }),
    ];
    const { visible } = selectVisibleSetups(setups);
    expect(visible.map((s) => s.id)).toEqual(['long-b']);
  });
});

describe('resolveSymbolVisibility', () => {
  it('picks the only direction present when there is no conflict to resolve', () => {
    const longs = [makeGeneratedSetup({ id: 'a', symbol: 'AUSDT', direction: 'LONG' })];
    const resolution = resolveSymbolVisibility(longs);
    expect(resolution.outcome).toBe('long');
    expect(resolution.visible?.id).toBe('a');
  });

  it('is conflicted when both directions score exactly zero (no evidence at all)', () => {
    const setups = [
      makeGeneratedSetup({ id: 'a', symbol: 'AUSDT', direction: 'LONG', supporting: [], opposing: [] }),
      makeGeneratedSetup({ id: 'b', symbol: 'AUSDT', direction: 'SHORT', supporting: [], opposing: [] }),
    ];
    const resolution = resolveSymbolVisibility(setups);
    expect(resolution.outcome).toBe('conflicted');
  });
});
