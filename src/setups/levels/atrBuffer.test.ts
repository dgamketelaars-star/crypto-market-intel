import { describe, expect, it } from 'vitest';
import { applyAtrBuffer, isWithinAtr } from './atrBuffer';

describe('applyAtrBuffer', () => {
  it('moves the level down for LONG (buffer below)', () => {
    expect(applyAtrBuffer(100, 2, 0.5, 'LONG')).toBe(99);
  });
  it('moves the level up for SHORT (buffer above)', () => {
    expect(applyAtrBuffer(100, 2, 0.5, 'SHORT')).toBe(101);
  });
});

describe('isWithinAtr', () => {
  it('is true when price is within the ATR multiple of the level', () => {
    expect(isWithinAtr(100, 101, 2, 0.75)).toBe(true);
  });
  it('is false when price is beyond the ATR multiple', () => {
    expect(isWithinAtr(100, 110, 2, 0.75)).toBe(false);
  });
  it('is false for a zero or negative ATR (avoids a false "always near")', () => {
    expect(isWithinAtr(100, 100, 0, 0.75)).toBe(false);
  });
});
