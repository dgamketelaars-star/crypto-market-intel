import { describe, expect, it } from 'vitest';
import { classifySymbol, computeSelectionSignature, selectSymbolsToAnalyze, type SystemOpinion } from './selectSymbolsToAnalyze';

function opinion(overrides: Partial<SystemOpinion> = {}): SystemOpinion {
  return { direction: 'LONG', confidence: 'medium', entryPrice: 100, stopPrice: 95, ...overrides };
}

describe('classifySymbol', () => {
  it('returns null when fewer than two systems have an opinion — nothing to compare', () => {
    expect(classifySymbol({ symbol: 'BTCUSDT', opinions: [opinion()] })).toBeNull();
    expect(classifySymbol({ symbol: 'BTCUSDT', opinions: [] })).toBeNull();
  });

  it('classifies as disagreement when directions differ, regardless of confidence/levels', () => {
    const result = classifySymbol({ symbol: 'ETHUSDT', opinions: [opinion({ direction: 'LONG' }), opinion({ direction: 'SHORT' })] });
    expect(result).toEqual({ symbol: 'ETHUSDT', reason: 'disagreement', systemsWithOpinion: 2 });
  });

  it('classifies as confidence_divergence when direction agrees but confidence spans two ordinal steps', () => {
    const result = classifySymbol({
      symbol: 'SOLUSDT',
      opinions: [opinion({ confidence: 'low' }), opinion({ confidence: 'high' })],
    });
    expect(result).toEqual({ symbol: 'SOLUSDT', reason: 'confidence_divergence', systemsWithOpinion: 2 });
  });

  it('does not flag confidence_divergence for a single-step gap (low vs medium)', () => {
    const result = classifySymbol({
      symbol: 'SOLUSDT',
      opinions: [opinion({ confidence: 'low', entryPrice: 100, stopPrice: 95 }), opinion({ confidence: 'medium', entryPrice: 100, stopPrice: 95 })],
    });
    expect(result?.reason).toBe('strong_consensus');
  });

  it('classifies as level_divergence when risk (stop distance %) differs by 2x or more at matching direction/confidence', () => {
    const result = classifySymbol({
      symbol: 'DOGEUSDT',
      opinions: [opinion({ entryPrice: 100, stopPrice: 98 }), opinion({ entryPrice: 100, stopPrice: 90 })], // 2% vs 10% risk
    });
    expect(result).toEqual({ symbol: 'DOGEUSDT', reason: 'level_divergence', systemsWithOpinion: 2 });
  });

  it('classifies as strong_consensus when direction, confidence, and risk all line up', () => {
    const result = classifySymbol({
      symbol: 'BTCUSDT',
      opinions: [opinion(), opinion(), opinion()],
    });
    expect(result).toEqual({ symbol: 'BTCUSDT', reason: 'strong_consensus', systemsWithOpinion: 3 });
  });

  it('prioritises disagreement over confidence or level differences when multiple conditions could apply', () => {
    const result = classifySymbol({
      symbol: 'XRPUSDT',
      opinions: [opinion({ direction: 'LONG', confidence: 'low' }), opinion({ direction: 'SHORT', confidence: 'high' })],
    });
    expect(result?.reason).toBe('disagreement');
  });
});

describe('selectSymbolsToAnalyze', () => {
  it('excludes symbols with fewer than two opinions', () => {
    const result = selectSymbolsToAnalyze([{ symbol: 'BTCUSDT', opinions: [opinion()] }], 5);
    expect(result).toEqual([]);
  });

  it('prioritises symbols with more independent opinions, then alphabetically', () => {
    const result = selectSymbolsToAnalyze(
      [
        { symbol: 'ZECUSDT', opinions: [opinion({ direction: 'LONG' }), opinion({ direction: 'SHORT' })] },
        { symbol: 'BTCUSDT', opinions: [opinion(), opinion(), opinion(), opinion()] },
        { symbol: 'ETHUSDT', opinions: [opinion({ direction: 'LONG' }), opinion({ direction: 'SHORT' })] },
      ],
      5,
    );
    expect(result.map((r) => r.symbol)).toEqual(['BTCUSDT', 'ETHUSDT', 'ZECUSDT']);
  });

  it('caps the result to maxSymbols', () => {
    const inputs = Array.from({ length: 10 }, (_, i) => ({
      symbol: `SYM${i}USDT`,
      opinions: [opinion({ direction: 'LONG' }), opinion({ direction: 'SHORT' })],
    }));
    const result = selectSymbolsToAnalyze(inputs, 3);
    expect(result).toHaveLength(3);
  });
});

describe('computeSelectionSignature', () => {
  it('produces the same signature for effectively unchanged inputs (tiny price/rounding noise)', () => {
    const input = { symbol: 'BTCUSDT', opinions: [opinion()] };
    const a = computeSelectionSignature(input, 100);
    const b = computeSelectionSignature(input, 100.01);
    expect(a).toBe(b);
  });

  it('produces a different signature when a system\'s direction changes', () => {
    const a = computeSelectionSignature({ symbol: 'BTCUSDT', opinions: [opinion({ direction: 'LONG' })] }, 100);
    const b = computeSelectionSignature({ symbol: 'BTCUSDT', opinions: [opinion({ direction: 'SHORT' })] }, 100);
    expect(a).not.toBe(b);
  });

  it('produces a different signature when the price moves meaningfully', () => {
    const input = { symbol: 'BTCUSDT', opinions: [opinion()] };
    const a = computeSelectionSignature(input, 100);
    const b = computeSelectionSignature(input, 110);
    expect(a).not.toBe(b);
  });
});
