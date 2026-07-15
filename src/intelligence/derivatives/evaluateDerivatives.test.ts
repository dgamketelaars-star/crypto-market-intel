import { describe, expect, it } from 'vitest';
import { makePositioning } from '../../setups/testUtils/analysisFixtures';
import type { LiquidationEvent, LongShortRatioData } from '../../services/binance/types';
import { evaluateDerivatives } from './evaluateDerivatives';

function liquidation(overrides: Partial<LiquidationEvent> = {}): LiquidationEvent {
  return { symbol: 'BTCUSDT', side: 'SELL', price: 100, quantity: 5, time: 1, ...overrides };
}

function longShortRatio(overrides: Partial<LongShortRatioData> = {}): LongShortRatioData {
  return { symbol: 'BTCUSDT', longShortRatio: 1, longAccountPct: 50, shortAccountPct: 50, time: 1, ...overrides };
}

describe('evaluateDerivatives', () => {
  it('returns insufficient_data when the positioning analysis is not sufficient', () => {
    const positioning = makePositioning({ sufficientData: false });
    expect(evaluateDerivatives(positioning, null, null, [], null, 1).conclusion).toBe('insufficient_data');
  });

  it('reads price up + rising OI as slightly_bullish (new longs entering)', () => {
    const positioning = makePositioning({ priceChange24hPct: 5, oiTrend: 'rising', fundingState: 'neutral' });
    const result = evaluateDerivatives(positioning, 100, 100, [], null, 1);
    expect(result.conclusion).toBe('slightly_bullish');
  });

  it('reads price down + rising OI as slightly_bearish (new shorts entering)', () => {
    const positioning = makePositioning({ priceChange24hPct: -5, oiTrend: 'rising', fundingState: 'neutral' });
    const result = evaluateDerivatives(positioning, 100, 100, [], null, 1);
    expect(result.conclusion).toBe('slightly_bearish');
  });

  it('reads price up + falling OI as neutral with an opposing short-covering note', () => {
    const positioning = makePositioning({ priceChange24hPct: 5, oiTrend: 'falling', fundingState: 'neutral' });
    const result = evaluateDerivatives(positioning, 100, 100, [], null, 1);
    expect(result.conclusion).toBe('neutral');
    expect(result.opposing.some((f) => f.description.includes('short covering'))).toBe(true);
  });

  it('flags elevated funding as a crowding risk on a bullish read, never flipping the conclusion to bearish', () => {
    const positioning = makePositioning({ priceChange24hPct: 5, oiTrend: 'rising', fundingState: 'very_elevated' });
    const result = evaluateDerivatives(positioning, 100, 100, [], null, 1);
    expect(result.conclusion).toBe('slightly_bullish');
    expect(result.opposing.some((f) => f.description.includes('crowded'))).toBe(true);
  });

  it('notes a meaningful mark-price basis when present', () => {
    const positioning = makePositioning({ priceChange24hPct: 0, oiTrend: 'flat' });
    const result = evaluateDerivatives(positioning, 101, 100, [], null, 1);
    expect(result.supporting.some((f) => f.description.includes('basis'))).toBe(true);
  });

  it('flags missing mark price data', () => {
    const positioning = makePositioning({ priceChange24hPct: 0, oiTrend: 'flat' });
    const result = evaluateDerivatives(positioning, null, null, [], null, 1);
    expect(result.missingData.some((m) => m.includes('Mark price'))).toBe(true);
  });

  it('flags missing long/short ratio data', () => {
    const positioning = makePositioning({ priceChange24hPct: 0, oiTrend: 'flat' });
    const result = evaluateDerivatives(positioning, 100, 100, [], null, 1);
    expect(result.missingData.some((m) => m.includes('long/short'))).toBe(true);
  });

  it('surfaces a crowded long/short ratio as a risk factor on a bullish read, never flipping the conclusion', () => {
    const positioning = makePositioning({ priceChange24hPct: 5, oiTrend: 'rising', fundingState: 'neutral' });
    const ratio = longShortRatio({ longShortRatio: 3.5, longAccountPct: 78, shortAccountPct: 22 });
    const result = evaluateDerivatives(positioning, 100, 100, [], ratio, 1);
    expect(result.conclusion).toBe('slightly_bullish');
    expect(result.opposing.some((f) => f.description.includes('long-skewed'))).toBe(true);
  });

  it('notes recent long liquidations as confirming supporting evidence on a bearish read', () => {
    const positioning = makePositioning({ priceChange24hPct: -5, oiTrend: 'rising', fundingState: 'neutral' });
    const liquidations = [liquidation({ side: 'SELL', quantity: 5, time: 100 }), liquidation({ side: 'SELL', quantity: 4, time: 200 })];
    const result = evaluateDerivatives(positioning, 100, 100, liquidations, null, 1000);
    expect(result.conclusion).toBe('slightly_bearish');
    expect(result.supporting.some((f) => f.description.toLowerCase().includes('recent long liquidations'))).toBe(true);
  });

  it('notes recent long liquidations as an opposing fragility risk on a bullish read', () => {
    const positioning = makePositioning({ priceChange24hPct: 5, oiTrend: 'rising', fundingState: 'neutral' });
    const liquidations = [liquidation({ side: 'SELL', quantity: 5, time: 100 }), liquidation({ side: 'SELL', quantity: 4, time: 200 })];
    const result = evaluateDerivatives(positioning, 100, 100, liquidations, null, 1000);
    expect(result.conclusion).toBe('slightly_bullish');
    expect(result.opposing.some((f) => f.description.toLowerCase().includes('recent long liquidations'))).toBe(true);
  });

  it('ignores liquidations that fall outside the lookback window', () => {
    const positioning = makePositioning({ priceChange24hPct: -5, oiTrend: 'rising', fundingState: 'neutral' });
    const veryOld = [liquidation({ side: 'SELL', quantity: 100, time: -10_000_000 })];
    const result = evaluateDerivatives(positioning, 100, 100, veryOld, null, 1_000_000);
    expect(result.supporting.some((f) => f.description.toLowerCase().includes('recent long liquidations'))).toBe(false);
  });
});
