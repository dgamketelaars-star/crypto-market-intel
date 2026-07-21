import { describe, expect, it } from 'vitest';
import type { FuturesSymbol, TickerData } from '../services/binance/types';
import { isEligibleForUniverse, selectTopUniverse } from './universeSelection';

const NOW = 1_700_000_000_000;
const OLD_ONBOARD = NOW - 365 * 24 * 60 * 60 * 1000;

function sym(symbol: string, overrides: Partial<FuturesSymbol> = {}): FuturesSymbol {
  return { symbol, baseAsset: symbol.replace('USDT', ''), quoteAsset: 'USDT', status: 'TRADING', contractType: 'PERPETUAL', onboardDate: OLD_ONBOARD, ...overrides };
}

function ticker(symbol: string, quoteVolume: number): TickerData {
  return { symbol, lastPrice: 100, priceChangePercent: 0, quoteVolume, time: NOW };
}

/** Builds N candidates ranked strictly by volume, symbol0 highest. */
function rankedUniverse(count: number, baseVolume = 100_000_000): { candidates: FuturesSymbol[]; tickers: TickerData[] } {
  const candidates: FuturesSymbol[] = [];
  const tickers: TickerData[] = [];
  for (let i = 0; i < count; i++) {
    const symbol = `SYM${i}USDT`;
    candidates.push(sym(symbol));
    tickers.push(ticker(symbol, baseVolume - i * 1000));
  }
  return { candidates, tickers };
}

describe('isEligibleForUniverse', () => {
  it('rejects leveraged-token-style base assets', () => {
    expect(isEligibleForUniverse(sym('BTCUPUSDT', { baseAsset: 'BTCUP' }), NOW)).toBe(false);
    expect(isEligibleForUniverse(sym('BTCBEARUSDT', { baseAsset: 'BTCBEAR' }), NOW)).toBe(false);
  });

  it('rejects symbols onboarded too recently to have reliable candle history', () => {
    expect(isEligibleForUniverse(sym('NEWUSDT', { onboardDate: NOW - 1000 }), NOW)).toBe(false);
  });

  it('accepts an established symbol', () => {
    expect(isEligibleForUniverse(sym('BTCUSDT'), NOW)).toBe(true);
  });
});

describe('selectTopUniverse', () => {
  it('always includes BTCUSDT and ETHUSDT even when their rank would otherwise exclude them', () => {
    const { candidates, tickers } = rankedUniverse(60);
    // Give BTC/ETH terrible volume so they'd never rank into the top 50 on merit alone.
    candidates.push(sym('BTCUSDT'), sym('ETHUSDT'));
    tickers.push(ticker('BTCUSDT', 1), ticker('ETHUSDT', 1));

    const universe = selectTopUniverse(candidates, tickers, new Set(), { now: NOW });
    const symbols = universe.map((s) => s.symbol);
    expect(symbols).toContain('BTCUSDT');
    expect(symbols).toContain('ETHUSDT');
  });

  it('selects the top 50 by 24h quote volume on a cold start with no previous universe', () => {
    const { candidates, tickers } = rankedUniverse(80);
    const universe = selectTopUniverse(candidates, tickers, new Set(), { now: NOW });
    // 50 by rank, none of them are BTC/ETH here so no forced additions.
    expect(universe).toHaveLength(50);
    expect(universe.map((s) => s.symbol)).toEqual(candidates.slice(0, 50).map((s) => s.symbol));
  });

  it('excludes candidates below the minimum quote volume floor regardless of relative rank', () => {
    const candidates = [sym('AUSDT'), sym('BUSDT')];
    const tickers = [ticker('AUSDT', 10_000_000), ticker('BUSDT', 100)];
    const universe = selectTopUniverse(candidates, tickers, new Set(), { now: NOW, topSize: 50 });
    expect(universe.map((s) => s.symbol)).toEqual(['AUSDT']);
  });

  it('excludes leveraged-token-style and too-new symbols from ranking even with high reported volume', () => {
    const candidates = [sym('AUSDT'), sym('BUPUSDT', { baseAsset: 'BUP' }), sym('CUSDT', { onboardDate: NOW - 1000 })];
    const tickers = [ticker('AUSDT', 50_000_000), ticker('BUPUSDT', 999_000_000), ticker('CUSDT', 999_000_000)];
    const universe = selectTopUniverse(candidates, tickers, new Set(), { now: NOW });
    expect(universe.map((s) => s.symbol)).toEqual(['AUSDT']);
  });

  it('keeps an incumbent whose rank drifted just past topSize as long as it is within the hysteresis buffer', () => {
    const { candidates, tickers } = rankedUniverse(60);
    // SYM50USDT (rank 50, 0-indexed -> just outside a topSize of 50) was in the previous universe.
    const previousSymbols = new Set(['SYM50USDT']);
    const universe = selectTopUniverse(candidates, tickers, previousSymbols, { now: NOW, topSize: 50, hysteresisBuffer: 10 });
    expect(universe.map((s) => s.symbol)).toContain('SYM50USDT');
  });

  it('drops an incumbent once its rank falls outside the hysteresis buffer entirely', () => {
    const { candidates, tickers } = rankedUniverse(70);
    const previousSymbols = new Set(['SYM65USDT']); // rank 65, buffer only covers up to topSize(50)+buffer(10)=60
    const universe = selectTopUniverse(candidates, tickers, previousSymbols, { now: NOW, topSize: 50, hysteresisBuffer: 10 });
    expect(universe.map((s) => s.symbol)).not.toContain('SYM65USDT');
  });

  it('does not admit a brand-new (non-incumbent) challenger sitting in the hysteresis zone — only strict top-N challengers are newly admitted', () => {
    const { candidates, tickers } = rankedUniverse(60);
    // No previous universe at all -> SYM50..SYM59 (ranks 50-59) are all "new", none should be admitted via hysteresis.
    const universe = selectTopUniverse(candidates, tickers, new Set(), { now: NOW, topSize: 50, hysteresisBuffer: 10 });
    expect(universe.map((s) => s.symbol)).not.toContain('SYM55USDT');
    expect(universe).toHaveLength(50);
  });
});
