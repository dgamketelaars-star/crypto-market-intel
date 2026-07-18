import { describe, expect, it } from 'vitest';
import { classifySymbol, selectSymbolsToAnalyze } from './selectSymbolsToAnalyze';

describe('classifySymbol', () => {
  it('returns null when fewer than two systems have an opinion — nothing to compare', () => {
    expect(classifySymbol({ symbol: 'BTCUSDT', directions: ['LONG'] })).toBeNull();
    expect(classifySymbol({ symbol: 'BTCUSDT', directions: [] })).toBeNull();
  });

  it('classifies as strong_consensus when all opinions agree', () => {
    const result = classifySymbol({ symbol: 'BTCUSDT', directions: ['LONG', 'LONG', 'LONG'] });
    expect(result).toEqual({ symbol: 'BTCUSDT', reason: 'strong_consensus', systemsWithOpinion: 3 });
  });

  it('classifies as disagreement when opinions differ', () => {
    const result = classifySymbol({ symbol: 'ETHUSDT', directions: ['LONG', 'SHORT'] });
    expect(result).toEqual({ symbol: 'ETHUSDT', reason: 'disagreement', systemsWithOpinion: 2 });
  });
});

describe('selectSymbolsToAnalyze', () => {
  it('excludes symbols with fewer than two opinions', () => {
    const result = selectSymbolsToAnalyze([{ symbol: 'BTCUSDT', directions: ['LONG'] }], 5);
    expect(result).toEqual([]);
  });

  it('prioritises symbols with more independent opinions, then alphabetically', () => {
    const result = selectSymbolsToAnalyze(
      [
        { symbol: 'ZECUSDT', directions: ['LONG', 'SHORT'] },
        { symbol: 'BTCUSDT', directions: ['LONG', 'LONG', 'LONG', 'LONG'] },
        { symbol: 'ETHUSDT', directions: ['LONG', 'SHORT'] },
      ],
      5,
    );
    expect(result.map((r) => r.symbol)).toEqual(['BTCUSDT', 'ETHUSDT', 'ZECUSDT']);
  });

  it('caps the result to maxSymbols', () => {
    const inputs = Array.from({ length: 10 }, (_, i) => ({ symbol: `SYM${i}USDT`, directions: ['LONG', 'SHORT'] as Array<'LONG' | 'SHORT'> }));
    const result = selectSymbolsToAnalyze(inputs, 3);
    expect(result).toHaveLength(3);
  });
});
