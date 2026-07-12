import { describe, expect, it } from 'vitest';
import { OFFLINE_AFTER_MS, STALE_AFTER_MS, classifyFreshness, isStale } from './freshness';

describe('isStale', () => {
  it('is stale when there is no updatedAt at all', () => {
    expect(isStale(undefined, 1_000)).toBe(true);
  });

  it('is not stale within the threshold', () => {
    expect(isStale(1_000, 1_000 + STALE_AFTER_MS - 1)).toBe(false);
  });

  it('is stale once past the threshold', () => {
    expect(isStale(1_000, 1_000 + STALE_AFTER_MS + 1)).toBe(true);
  });
});

describe('classifyFreshness', () => {
  const now = 1_000_000;

  it('is stale when there is no updatedAt at all', () => {
    expect(classifyFreshness(undefined, now)).toBe('stale');
  });

  it('is live within STALE_AFTER_MS', () => {
    expect(classifyFreshness(now - STALE_AFTER_MS + 1, now)).toBe('live');
  });

  it('is delayed between STALE_AFTER_MS and OFFLINE_AFTER_MS', () => {
    expect(classifyFreshness(now - STALE_AFTER_MS - 1, now)).toBe('delayed');
    expect(classifyFreshness(now - OFFLINE_AFTER_MS + 1, now)).toBe('delayed');
  });

  it('is stale past OFFLINE_AFTER_MS', () => {
    expect(classifyFreshness(now - OFFLINE_AFTER_MS - 1, now)).toBe('stale');
  });
});
