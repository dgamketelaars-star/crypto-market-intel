import { describe, expect, it } from 'vitest';
import { mapWithConcurrency } from './concurrency';

describe('mapWithConcurrency', () => {
  it('one item failing does not block or cancel the rest of the batch', async () => {
    const items = [1, 2, 3, 4, 5];
    const results = await mapWithConcurrency(
      items,
      async (n) => {
        if (n === 3) throw new Error(`boom on ${n}`);
        return n * 10;
      },
      2,
    );

    expect(results).toHaveLength(5);
    expect(results[2]).toEqual({ status: 'rejected', reason: expect.any(Error) });
    // Every other item still completed successfully despite item 3's failure.
    expect(results[0]).toEqual({ status: 'fulfilled', value: 10 });
    expect(results[1]).toEqual({ status: 'fulfilled', value: 20 });
    expect(results[3]).toEqual({ status: 'fulfilled', value: 40 });
    expect(results[4]).toEqual({ status: 'fulfilled', value: 50 });
  });

  it('respects the concurrency cap (never more than N in flight at once)', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const items = Array.from({ length: 20 }, (_, i) => i);

    await mapWithConcurrency(
      items,
      async (n) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 1));
        inFlight--;
        return n;
      },
      4,
    );

    expect(maxInFlight).toBeLessThanOrEqual(4);
  });

  it('processes every item exactly once, in order, for an all-success batch', async () => {
    const items = ['a', 'b', 'c'];
    const results = await mapWithConcurrency(items, async (s) => s.toUpperCase(), 3);
    expect(results.map((r) => (r.status === 'fulfilled' ? r.value : null))).toEqual(['A', 'B', 'C']);
  });
});
