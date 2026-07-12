import { describe, expect, it } from 'vitest';
import { makeCandlesFromCloses } from '../testUtils/fixtures';
import { analyseSymbol } from './analyseSymbol';

describe('analyseSymbol — missing/malformed data safety', () => {
  it('handles a symbol with no candles at all without throwing', () => {
    const result = analyseSymbol({
      symbol: 'TESTUSDT',
      candles: {},
      quoteVolumeRank: null,
      universeSize: null,
      oiHistory: [],
      fundingHistory: [],
      calculatedAt: 1_700_000_000_000,
    });
    expect(result.symbol).toBe('TESTUSDT');
    expect(result.timeframes['1h']).toBeUndefined();
    expect(result.volume.sufficientData).toBe(false);
    expect(result.positioning.sufficientData).toBe(false);
    expect(result.attention).toBe('insufficient_data');
  });

  it('handles zero-volume candles without producing NaN/Infinity', () => {
    const candles = makeCandlesFromCloses(
      Array.from({ length: 30 }, () => 100),
      { volume: 0 },
    );
    const result = analyseSymbol({
      symbol: 'ZEROVOLUSDT',
      candles: { '1h': candles },
      quoteVolumeRank: 5,
      universeSize: 20,
      oiHistory: [],
      fundingHistory: [],
      calculatedAt: Date.now(),
    });
    expect(result.volume.currentVolume).toBe(0);
    if (result.volume.relativeVolume !== null) {
      expect(Number.isFinite(result.volume.relativeVolume)).toBe(true);
    }
  });

  it('handles a missing Open Interest / funding / ticker snapshot gracefully', () => {
    const candles = makeCandlesFromCloses(Array.from({ length: 30 }, (_, i) => 100 + i));
    const result = analyseSymbol({
      symbol: 'NOOIUSDT',
      candles: { '1h': candles },
      ticker: undefined,
      funding: undefined,
      openInterest: undefined,
      quoteVolumeRank: 1,
      universeSize: 20,
      oiHistory: [],
      fundingHistory: [],
      calculatedAt: Date.now(),
    });
    expect(result.positioning.openInterest).toBeNull();
    expect(result.positioning.oiTrend).toBe('insufficient_data');
    expect(result.positioning.sufficientData).toBe(false);
  });

  it('never leaks NaN or Infinity into numeric fields for a fully-populated symbol', () => {
    const closes = Array.from({ length: 260 }, (_, i) => 100 + Math.sin(i / 5) * 10 + i * 0.05);
    const candles = makeCandlesFromCloses(closes);
    const now = Date.now();
    const result = analyseSymbol({
      symbol: 'FULLUSDT',
      candles: { '15m': candles, '1h': candles, '4h': candles, '1d': candles },
      ticker: { symbol: 'FULLUSDT', lastPrice: closes.at(-1)!, priceChangePercent: 1.2, quoteVolume: 1_000_000, time: now },
      funding: { symbol: 'FULLUSDT', fundingRate: 0.0002, nextFundingTime: now, time: now },
      openInterest: { symbol: 'FULLUSDT', openInterest: 50_000, time: now },
      quoteVolumeRank: 3,
      universeSize: 20,
      oiHistory: [{ time: now - 4 * 60 * 60 * 1000, openInterest: 48_000 }],
      fundingHistory: [{ time: now - 60 * 60 * 1000, fundingRate: 0.0001 }],
      calculatedAt: now,
    });

    const numbers: (number | null)[] = [
      result.volume.currentVolume,
      result.volume.averageVolume20,
      result.volume.relativeVolume,
      result.positioning.fundingRate,
      result.positioning.oiChange4hPct,
      result.timeframes['1h']?.trend.priceVsEma20Pct ?? null,
      result.timeframes['1h']?.momentum.rsi14.value ?? null,
      result.timeframes['1h']?.volatility.atrPct ?? null,
    ];
    for (const n of numbers) {
      if (n !== null) expect(Number.isFinite(n)).toBe(true);
    }
  });

  it('marks the result stale-free/insufficient rather than crashing on a single malformed candle (NaN close)', () => {
    const candles = makeCandlesFromCloses(Array.from({ length: 30 }, (_, i) => 100 + i));
    candles[10] = { ...candles[10], close: Number.NaN };
    expect(() =>
      analyseSymbol({
        symbol: 'MALFORMEDUSDT',
        candles: { '1h': candles },
        quoteVolumeRank: 1,
        universeSize: 20,
        oiHistory: [],
        fundingHistory: [],
        calculatedAt: Date.now(),
      }),
    ).not.toThrow();
  });
});

describe('analyseSymbol — attention level integration', () => {
  it('flags unusual_activity when volume, volatility and open interest all deviate together', () => {
    const baseCloses = Array.from({ length: 259 }, () => 100);
    const candles = makeCandlesFromCloses(baseCloses, { volume: 100 });
    candles.push({
      openTime: candles.length * 60 * 60_000,
      closeTime: candles.length * 60 * 60_000 + 3_599_999,
      open: 100,
      high: 130,
      low: 95,
      close: 128,
      volume: 5000,
      isFinal: true,
    });

    const now = Date.now();
    const result = analyseSymbol({
      symbol: 'SPIKEUSDT',
      candles: { '1h': candles },
      ticker: { symbol: 'SPIKEUSDT', lastPrice: 128, priceChangePercent: 28, quoteVolume: 10_000_000, time: now },
      funding: { symbol: 'SPIKEUSDT', fundingRate: 0.0002, nextFundingTime: now, time: now },
      openInterest: { symbol: 'SPIKEUSDT', openInterest: 60_000, time: now },
      quoteVolumeRank: 2,
      universeSize: 20,
      oiHistory: [{ time: now - 4 * 60 * 60 * 1000, openInterest: 45_000 }],
      fundingHistory: [],
      calculatedAt: now,
    });

    expect(result.volume.classification).toBe('spike');
    expect(['elevated', 'extreme']).toContain(result.timeframes['1h']!.volatility.classification);
    expect(result.positioning.oiTrend).toBe('rising');
    expect(result.attention).toBe('unusual_activity');
    expect(result.explanation.supporting.length).toBeGreaterThanOrEqual(3);
  });

  it('is normal for a calm, unremarkable symbol', () => {
    const closes = Array.from({ length: 260 }, (_, i) => 100 + Math.sin(i / 30) * 0.2);
    const candles = makeCandlesFromCloses(closes, { volume: 100 });
    const now = Date.now();
    const result = analyseSymbol({
      symbol: 'CALMUSDT',
      candles: { '1h': candles },
      ticker: { symbol: 'CALMUSDT', lastPrice: 100, priceChangePercent: 0.1, quoteVolume: 500_000, time: now },
      funding: { symbol: 'CALMUSDT', fundingRate: 0.0001, nextFundingTime: now, time: now },
      openInterest: { symbol: 'CALMUSDT', openInterest: 20_000, time: now },
      quoteVolumeRank: 10,
      universeSize: 20,
      oiHistory: [{ time: now - 4 * 60 * 60 * 1000, openInterest: 20_010 }],
      fundingHistory: [0.0001, 0.0001, 0.0001, 0.00011, 0.0001, 0.00009].map((r, i) => ({
        time: now - (6 - i) * 60 * 60 * 1000,
        fundingRate: r,
      })),
      calculatedAt: now,
    });

    expect(result.attention).toBe('normal');
  });
});
