import { describe, expect, it } from 'vitest';
import { isVolumeConfirming, isVolumeStronglyConfirming } from './rules';

describe('isVolumeConfirming', () => {
  it('confirms on elevated or spike', () => {
    expect(isVolumeConfirming('elevated')).toBe(true);
    expect(isVolumeConfirming('spike')).toBe(true);
  });
  it('does not confirm on normal, low, or insufficient_data', () => {
    expect(isVolumeConfirming('normal')).toBe(false);
    expect(isVolumeConfirming('low')).toBe(false);
    expect(isVolumeConfirming('insufficient_data')).toBe(false);
  });
});

describe('isVolumeStronglyConfirming', () => {
  it('only confirms on spike', () => {
    expect(isVolumeStronglyConfirming('spike')).toBe(true);
    expect(isVolumeStronglyConfirming('elevated')).toBe(false);
  });
});
