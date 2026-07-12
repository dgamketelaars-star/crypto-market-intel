import { describe, expect, it } from 'vitest';
import type { SetupCondition } from './types';
import { deriveReadiness } from './readiness';

const cond = (met: boolean): SetupCondition => ({ key: 'k', label: 'l', met, detail: '' });

describe('deriveReadiness', () => {
  it('is none when any context condition fails, regardless of confirmation', () => {
    expect(deriveReadiness([cond(true), cond(false)], [cond(true)], false)).toBe('none');
  });

  it('is active_ready when context and confirmation are all met', () => {
    expect(deriveReadiness([cond(true), cond(true)], [cond(true), cond(true)], false)).toBe('active_ready');
  });

  it('is waiting_for_confirmation when context met, confirmation not met, but price is near the trigger', () => {
    expect(deriveReadiness([cond(true)], [cond(true), cond(false)], true)).toBe('waiting_for_confirmation');
  });

  it('is candidate when context met, confirmation not met, and price is not near the trigger', () => {
    expect(deriveReadiness([cond(true)], [cond(true), cond(false)], false)).toBe('candidate');
  });

  it('treats an empty confirmation list as satisfied (active_ready) when context holds', () => {
    expect(deriveReadiness([cond(true)], [], false)).toBe('active_ready');
  });

  it('treats an empty context list as satisfied by default', () => {
    expect(deriveReadiness([], [cond(false)], false)).toBe('candidate');
  });
});
