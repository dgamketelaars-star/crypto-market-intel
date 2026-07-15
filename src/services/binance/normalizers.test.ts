import { describe, expect, it } from 'vitest';
import { normalizeLiquidationStream, normalizeLongShortRatioRest } from './normalizers';

describe('normalizeLiquidationStream', () => {
  it('parses a forceOrder stream event, preferring average price over order price', () => {
    const raw = {
      e: 'forceOrder',
      E: 1700000000123,
      o: { s: 'BTCUSDT', S: 'SELL', o: 'LIMIT', f: 'IOC', q: '0.014', p: '9910', ap: '9905', X: 'FILLED', l: '0.014', z: '0.014', T: 1700000000100 },
    };
    expect(normalizeLiquidationStream(raw)).toEqual({ symbol: 'BTCUSDT', side: 'SELL', price: 9905, quantity: 0.014, time: 1700000000100 });
  });

  it('reads BUY-side liquidations (a short position being liquidated)', () => {
    const raw = { E: 1, o: { s: 'ETHUSDT', S: 'BUY', ap: '3000', q: '1.5', T: 1 } };
    expect(normalizeLiquidationStream(raw).side).toBe('BUY');
  });

  it('falls back to the order price and event time when average price / trade time are absent', () => {
    const raw = { E: 5, o: { s: 'SOLUSDT', S: 'SELL', p: '100', q: '10' } };
    const result = normalizeLiquidationStream(raw);
    expect(result.price).toBe(100);
    expect(result.time).toBe(5);
  });

  it('throws on a malformed payload instead of returning garbage', () => {
    expect(() => normalizeLiquidationStream({})).toThrow();
    expect(() => normalizeLiquidationStream({ o: {} })).toThrow();
    expect(() => normalizeLiquidationStream(null)).toThrow();
  });
});

describe('normalizeLongShortRatioRest', () => {
  it('parses a topLongShortAccountRatio row and scales account shares to percentages', () => {
    const raw = { symbol: 'BTCUSDT', longShortRatio: '2.5', longAccount: '0.7143', shortAccount: '0.2857', timestamp: 1700000000000 };
    const result = normalizeLongShortRatioRest(raw);
    expect(result.symbol).toBe('BTCUSDT');
    expect(result.longShortRatio).toBeCloseTo(2.5);
    expect(result.longAccountPct).toBeCloseTo(71.43);
    expect(result.shortAccountPct).toBeCloseTo(28.57);
    expect(result.time).toBe(1700000000000);
  });

  it('throws on a malformed payload', () => {
    expect(() => normalizeLongShortRatioRest({})).toThrow();
    expect(() => normalizeLongShortRatioRest(null)).toThrow();
  });
});
