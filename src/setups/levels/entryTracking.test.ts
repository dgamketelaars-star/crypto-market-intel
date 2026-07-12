import { describe, expect, it } from 'vitest';
import { calculateEntryDistance, isEntryMissed, updateExcursions } from './entryTracking';

describe('isEntryMissed', () => {
  it('LONG: not missed when price is at or below the trigger', () => {
    expect(isEntryMissed('LONG', 100, 100, 2)).toBe(false);
    expect(isEntryMissed('LONG', 100, 98, 2)).toBe(false);
  });

  it('LONG: not missed within the ATR-based allowed distance', () => {
    expect(isEntryMissed('LONG', 100, 101.9, 2)).toBe(false);
  });

  it('LONG: missed once price has run further than maxMissedEntryAtrMult * ATR beyond the trigger', () => {
    expect(isEntryMissed('LONG', 100, 102.1, 2)).toBe(true);
  });

  it('SHORT: missed once price has dropped further than maxMissedEntryAtrMult * ATR below the trigger', () => {
    expect(isEntryMissed('SHORT', 100, 97.9, 2)).toBe(true);
    expect(isEntryMissed('SHORT', 100, 98.5, 2)).toBe(false);
  });

  it('SHORT: being on the wrong side of the trigger (price above) is not "missed" — that is an invalidation concern', () => {
    expect(isEntryMissed('SHORT', 100, 105, 2)).toBe(false);
  });

  it('never reports missed when ATR is zero or negative (defensive)', () => {
    expect(isEntryMissed('LONG', 100, 200, 0)).toBe(false);
    expect(isEntryMissed('LONG', 100, 200, -1)).toBe(false);
  });
});

describe('updateExcursions', () => {
  it('LONG: highest favourable excursion only ever increases, adverse only ever decreases', () => {
    const a = updateExcursions('LONG', 110, 110, 120);
    expect(a).toEqual({ favorable: 120, adverse: 110 });
    const b = updateExcursions('LONG', a.favorable, a.adverse, 105);
    expect(b).toEqual({ favorable: 120, adverse: 105 });
  });

  it('SHORT: highest favourable excursion is the lowest price seen, adverse is the highest', () => {
    const a = updateExcursions('SHORT', 100, 100, 90);
    expect(a).toEqual({ favorable: 90, adverse: 100 });
    const b = updateExcursions('SHORT', a.favorable, a.adverse, 105);
    expect(b).toEqual({ favorable: 90, adverse: 105 });
  });
});

describe('calculateEntryDistance', () => {
  it('LONG favourable/unfavourable sign convention', () => {
    expect(calculateEntryDistance('LONG', 100, 110)).toEqual({ pct: 10, favorable: true });
    expect(calculateEntryDistance('LONG', 100, 90)).toEqual({ pct: -10, favorable: false });
  });

  it('SHORT favourable/unfavourable sign convention (mirrors LONG)', () => {
    const down = calculateEntryDistance('SHORT', 100, 90);
    expect(down.pct).toBe(-10);
    expect(down.favorable).toBe(true);
    const up = calculateEntryDistance('SHORT', 100, 110);
    expect(up.pct).toBe(10);
    expect(up.favorable).toBe(false);
  });

  it('treats zero change as favourable for both directions', () => {
    expect(calculateEntryDistance('LONG', 100, 100)).toEqual({ pct: 0, favorable: true });
    expect(calculateEntryDistance('SHORT', 100, 100)).toEqual({ pct: 0, favorable: true });
  });

  it('defends against a zero entry price', () => {
    expect(calculateEntryDistance('LONG', 0, 100)).toEqual({ pct: 0, favorable: false });
  });
});
