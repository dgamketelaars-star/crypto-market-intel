import { describe, expect, it } from 'vitest';
import type { FuturesSymbol } from '../../services/binance/types';
import type { SymbolMarketData } from '../../store/marketDataStore';
import { makeCandlesFromCloses } from '../testUtils/fixtures';
import { analyseUniverse } from './analyseUniverse';

function symbolDef(symbol: string): FuturesSymbol {
  return { symbol, baseAsset: symbol.replace('USDT', ''), quoteAsset: 'USDT', status: 'TRADING', contractType: 'PERPETUAL' };
}

function marketData(symbol: string, closes: number[], quoteVolume?: number): SymbolMarketData {
  return {
    symbol,
    candles: { '1h': makeCandlesFromCloses(closes) },
    ticker:
      quoteVolume !== undefined
        ? { symbol, lastPrice: closes.at(-1)!, priceChangePercent: 1, quoteVolume, time: Date.now() }
        : undefined,
    recentLiquidations: [],
    updatedAt: Date.now(),
  };
}

describe('analyseUniverse — dynamic top-50 membership', () => {
  it('only analyses symbols present in both the universe list and bySymbol data', () => {
    const universe = [symbolDef('AAAUSDT'), symbolDef('BBBUSDT')];
    const bySymbol = {
      AAAUSDT: marketData('AAAUSDT', Array.from({ length: 30 }, (_, i) => 100 + i)),
      // BBBUSDT just entered the universe — no market data has arrived for it yet.
    };

    const result = analyseUniverse(universe, bySymbol);
    expect(Object.keys(result)).toEqual(['AAAUSDT']);
    expect(result.BBBUSDT).toBeUndefined();
  });

  it('drops a symbol cleanly once it leaves the universe, without crashing on stale entries', () => {
    const bySymbol = {
      AAAUSDT: marketData('AAAUSDT', Array.from({ length: 30 }, (_, i) => 100 + i)),
      BBBUSDT: marketData('BBBUSDT', Array.from({ length: 30 }, (_, i) => 50 + i)),
    };
    const fullUniverse = [symbolDef('AAAUSDT'), symbolDef('BBBUSDT')];
    const shrunkUniverse = fullUniverse.filter((s) => s.symbol === 'AAAUSDT');

    const before = analyseUniverse(fullUniverse, bySymbol);
    expect(Object.keys(before).sort()).toEqual(['AAAUSDT', 'BBBUSDT']);

    const after = analyseUniverse(shrunkUniverse, bySymbol);
    expect(Object.keys(after)).toEqual(['AAAUSDT']);
  });

  it('ranks quoteVolumeRank by 24h quote volume across the universe', () => {
    const universe = [symbolDef('HIGHUSDT'), symbolDef('LOWUSDT')];
    const bySymbol = {
      HIGHUSDT: marketData('HIGHUSDT', Array.from({ length: 30 }, (_, i) => 100 + i), 1_000_000),
      LOWUSDT: marketData('LOWUSDT', Array.from({ length: 30 }, (_, i) => 50 + i), 10_000),
    };

    const result = analyseUniverse(universe, bySymbol);
    expect(result.HIGHUSDT.volume.quoteVolumeRank).toBe(1);
    expect(result.LOWUSDT.volume.quoteVolumeRank).toBe(2);
    expect(result.HIGHUSDT.volume.universeSize).toBe(2);
  });

  it('handles an empty universe without throwing', () => {
    expect(() => analyseUniverse([], {})).not.toThrow();
    expect(analyseUniverse([], {})).toEqual({});
  });
});
