import { describe, expect, it } from 'vitest';
import type { SetupEvidence } from '../engine/types';
import { calculateSignalStrength, downgradeStrength } from './strength';

const ev = (group: SetupEvidence['group']): SetupEvidence => ({ group, label: group, detail: '' });

describe('calculateSignalStrength', () => {
  it('is Low with 0 or 1 net supporting groups', () => {
    expect(calculateSignalStrength([], [])).toBe('Low');
    expect(calculateSignalStrength([ev('trend')], [])).toBe('Low');
  });

  it('is Medium with 2 net supporting groups', () => {
    expect(calculateSignalStrength([ev('trend'), ev('momentum')], [])).toBe('Medium');
  });

  it('is High with 3 net supporting groups', () => {
    expect(calculateSignalStrength([ev('trend'), ev('momentum'), ev('volume')], [])).toBe('High');
  });

  it('is Very high with 4+ net supporting groups', () => {
    expect(
      calculateSignalStrength([ev('trend'), ev('momentum'), ev('volume'), ev('market_structure')], []),
    ).toBe('Very high');
  });

  it('does not double-count the same evidence group twice', () => {
    expect(calculateSignalStrength([ev('trend'), ev('trend'), ev('trend')], [])).toBe('Low');
  });

  it('subtracts opposing groups from the net score', () => {
    expect(
      calculateSignalStrength(
        [ev('trend'), ev('momentum'), ev('volume'), ev('market_structure')],
        [ev('volatility')],
      ),
    ).toBe('High');
  });
});

describe('downgradeStrength', () => {
  it('drops exactly one tier', () => {
    expect(downgradeStrength('High')).toBe('Medium');
  });
  it('never drops below Low', () => {
    expect(downgradeStrength('Low')).toBe('Low');
  });
  it('supports dropping multiple tiers', () => {
    expect(downgradeStrength('Very high', 2)).toBe('Medium');
  });
});
