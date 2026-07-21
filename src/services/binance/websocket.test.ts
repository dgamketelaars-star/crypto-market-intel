import { describe, expect, it } from 'vitest';
import { ShardedBinanceMarketStream, shardIndexForStream, symbolFromStreamName } from './websocket';

describe('symbolFromStreamName', () => {
  it('extracts the symbol prefix before the @', () => {
    expect(symbolFromStreamName('btcusdt@kline_1h')).toBe('btcusdt');
    expect(symbolFromStreamName('ethusdt@markPrice@1s')).toBe('ethusdt');
  });

  it('returns the stream name unchanged when there is no @ (e.g. the all-market forceOrder stream)', () => {
    expect(symbolFromStreamName('!forceOrder@arr')).toBe('!forceOrder');
  });
});

describe('shardIndexForStream', () => {
  it('is stable for a symbol regardless of which shard count-relevant streams surround it', () => {
    const shardCount = 3;
    const a = shardIndexForStream('btcusdt@kline_1h', shardCount);
    const b = shardIndexForStream('btcusdt@ticker', shardCount);
    const c = shardIndexForStream('btcusdt@markPrice@1s', shardCount);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('always returns an index within [0, shardCount)', () => {
    const shardCount = 4;
    for (let i = 0; i < 100; i++) {
      const index = shardIndexForStream(`sym${i}usdt@kline_1h`, shardCount);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(shardCount);
    }
  });

  it('spreads symbols across all shards rather than collapsing onto one', () => {
    const shardCount = 3;
    const used = new Set<number>();
    for (let i = 0; i < 60; i++) used.add(shardIndexForStream(`sym${i}usdt@kline_1h`, shardCount));
    expect(used.size).toBe(shardCount);
  });
});

describe('ShardedBinanceMarketStream.shardCountFor', () => {
  it('stays at 1 shard for a small stream count', () => {
    expect(ShardedBinanceMarketStream.shardCountFor(50)).toBe(1);
  });

  it('requires multiple shards once the stream count exceeds Binance\'s ~200-per-connection limit', () => {
    // 50 symbols * 6 streams (ticker + markPrice + 4 kline intervals) = 300
    expect(ShardedBinanceMarketStream.shardCountFor(300)).toBeGreaterThanOrEqual(2);
  });

  it('scales up further for a larger stream count', () => {
    expect(ShardedBinanceMarketStream.shardCountFor(1000)).toBeGreaterThanOrEqual(6);
  });
});
