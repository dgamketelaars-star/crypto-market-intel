import { describe, expect, it } from 'vitest';
import { makeTrend } from '../../setups/testUtils/analysisFixtures';
import { evaluateMarketContext } from './evaluateMarketContext';

describe('evaluateMarketContext', () => {
  it('is neutral and self-referential for BTC itself', () => {
    const result = evaluateMarketContext({ symbol: 'BTCUSDT', btcRegimeBias: 'bullish', ethTrend: undefined, breadthBullishSharePct: null, sourceTimestamp: 1 });
    expect(result.conclusion).toBe('neutral');
  });

  it('is neutral when BTC regime itself has no bias', () => {
    const result = evaluateMarketContext({ symbol: 'SOLUSDT', btcRegimeBias: 'neutral', ethTrend: undefined, breadthBullishSharePct: null, sourceTimestamp: 1 });
    expect(result.conclusion).toBe('neutral');
  });

  it('concludes bullish when both ETH and breadth confirm BTC bullish bias', () => {
    const ethTrend = makeTrend({ classification: 'uptrend' }, '4h');
    const result = evaluateMarketContext({ symbol: 'SOLUSDT', btcRegimeBias: 'bullish', ethTrend, breadthBullishSharePct: 0.7, sourceTimestamp: 1 });
    expect(result.conclusion).toBe('bullish');
  });

  it('concludes slightly_bullish when only one of ETH/breadth confirms', () => {
    const ethTrend = makeTrend({ classification: 'sideways' }, '4h');
    const result = evaluateMarketContext({ symbol: 'SOLUSDT', btcRegimeBias: 'bullish', ethTrend, breadthBullishSharePct: 0.7, sourceTimestamp: 1 });
    expect(result.conclusion).toBe('slightly_bullish');
  });

  it('downgrades to neutral (weak/contradicted context) when both ETH and breadth oppose BTC bullish bias', () => {
    const ethTrend = makeTrend({ classification: 'downtrend' }, '4h');
    const result = evaluateMarketContext({ symbol: 'SOLUSDT', btcRegimeBias: 'bullish', ethTrend, breadthBullishSharePct: 0.2, sourceTimestamp: 1 });
    expect(result.conclusion).toBe('neutral');
    expect(result.supporting.some((f) => f.description.includes('weak/contradicted'))).toBe(true);
  });

  it('concludes bearish when both ETH and breadth confirm BTC bearish bias', () => {
    const ethTrend = makeTrend({ classification: 'downtrend' }, '4h');
    const result = evaluateMarketContext({ symbol: 'SOLUSDT', btcRegimeBias: 'bearish', ethTrend, breadthBullishSharePct: 0.15, sourceTimestamp: 1 });
    expect(result.conclusion).toBe('bearish');
  });

  it('flags missing ETH and breadth data', () => {
    const result = evaluateMarketContext({ symbol: 'SOLUSDT', btcRegimeBias: 'bullish', ethTrend: undefined, breadthBullishSharePct: null, sourceTimestamp: 1 });
    expect(result.missingData).toContain('ETH trend unavailable.');
    expect(result.missingData).toContain('Breadth across the Top-20 unavailable.');
  });
});
