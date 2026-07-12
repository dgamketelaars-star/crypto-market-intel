import { describe, expect, it } from 'vitest';
import { makePositioning } from '../../setups/testUtils/analysisFixtures';
import { evaluateDerivatives } from './evaluateDerivatives';

describe('evaluateDerivatives', () => {
  it('returns insufficient_data when the positioning analysis is not sufficient', () => {
    const positioning = makePositioning({ sufficientData: false });
    expect(evaluateDerivatives(positioning, null, null, 1).conclusion).toBe('insufficient_data');
  });

  it('reads price up + rising OI as slightly_bullish (new longs entering)', () => {
    const positioning = makePositioning({ priceChange24hPct: 5, oiTrend: 'rising', fundingState: 'neutral' });
    const result = evaluateDerivatives(positioning, 100, 100, 1);
    expect(result.conclusion).toBe('slightly_bullish');
  });

  it('reads price down + rising OI as slightly_bearish (new shorts entering)', () => {
    const positioning = makePositioning({ priceChange24hPct: -5, oiTrend: 'rising', fundingState: 'neutral' });
    const result = evaluateDerivatives(positioning, 100, 100, 1);
    expect(result.conclusion).toBe('slightly_bearish');
  });

  it('reads price up + falling OI as neutral with an opposing short-covering note', () => {
    const positioning = makePositioning({ priceChange24hPct: 5, oiTrend: 'falling', fundingState: 'neutral' });
    const result = evaluateDerivatives(positioning, 100, 100, 1);
    expect(result.conclusion).toBe('neutral');
    expect(result.opposing.some((f) => f.description.includes('short covering'))).toBe(true);
  });

  it('flags elevated funding as a crowding risk on a bullish read, never flipping the conclusion to bearish', () => {
    const positioning = makePositioning({ priceChange24hPct: 5, oiTrend: 'rising', fundingState: 'very_elevated' });
    const result = evaluateDerivatives(positioning, 100, 100, 1);
    expect(result.conclusion).toBe('slightly_bullish');
    expect(result.opposing.some((f) => f.description.includes('crowded'))).toBe(true);
  });

  it('notes a meaningful mark-price basis when present', () => {
    const positioning = makePositioning({ priceChange24hPct: 0, oiTrend: 'flat' });
    const result = evaluateDerivatives(positioning, 101, 100, 1);
    expect(result.supporting.some((f) => f.description.includes('basis'))).toBe(true);
  });

  it('flags missing mark price data', () => {
    const positioning = makePositioning({ priceChange24hPct: 0, oiTrend: 'flat' });
    const result = evaluateDerivatives(positioning, null, null, 1);
    expect(result.missingData.some((m) => m.includes('Mark price'))).toBe(true);
  });
});
