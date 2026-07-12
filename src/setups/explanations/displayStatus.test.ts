import { describe, expect, it } from 'vitest';
import { describeClosedReason, getDisplayStatus } from './displayStatus';

describe('getDisplayStatus', () => {
  it('maps candidate to waiting_entry', () => {
    expect(getDisplayStatus('candidate')).toBe('waiting_entry');
  });

  it('maps waiting_for_confirmation to entry_zone', () => {
    expect(getDisplayStatus('waiting_for_confirmation')).toBe('entry_zone');
  });

  it('maps active to active', () => {
    expect(getDisplayStatus('active')).toBe('active');
  });

  it('collapses invalidated, completed and expired all into closed', () => {
    expect(getDisplayStatus('invalidated')).toBe('closed');
    expect(getDisplayStatus('completed')).toBe('closed');
    expect(getDisplayStatus('expired')).toBe('closed');
  });
});

describe('describeClosedReason', () => {
  it('describes each closed reason in plain Dutch', () => {
    expect(describeClosedReason('target')).toBe('koersdoel bereikt');
    expect(describeClosedReason('invalidation')).toBe('invalidation-niveau geraakt');
    expect(describeClosedReason('expired')).toBe('verlopen zonder bevestiging');
  });

  it('falls back to a generic label when there is no reason', () => {
    expect(describeClosedReason(null)).toBe('gesloten');
  });
});
