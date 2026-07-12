import { describe, expect, it } from 'vitest';
import { makeSymbolAnalysis, makeTimeframe, makeTrend, makeVolatility } from '../testUtils/analysisFixtures';
import { applyMarketContextGate } from './marketContextGate';

describe('applyMarketContextGate', () => {
  it('never gates BTC itself', () => {
    const btcAnalysis = makeSymbolAnalysis({
      symbol: 'BTCUSDT',
      timeframes: { '4h': makeTimeframe({ trend: makeTrend({ classification: 'downtrend', emaAlignment: 'bearish' }, '4h') }, '4h') },
    });
    const result = applyMarketContextGate('BTCUSDT', 'LONG', btcAnalysis);
    expect(result.adjustment.applied).toBe(false);
  });

  it('leaves an altcoin LONG unadjusted with no BTC data', () => {
    const result = applyMarketContextGate('SOLUSDT', 'LONG', null);
    expect(result.adjustment.applied).toBe(false);
    expect(result.requireStrongerConfirmation).toBe(false);
    expect(result.forceInvalidate).toBe(false);
  });

  it('requires stronger confirmation for a LONG when BTC is in a 4H downtrend', () => {
    const btcAnalysis = makeSymbolAnalysis({
      symbol: 'BTCUSDT',
      timeframes: {
        '4h': makeTimeframe({ trend: makeTrend({ classification: 'downtrend', emaAlignment: 'bearish' }, '4h') }, '4h'),
        '1h': makeTimeframe({ volatility: makeVolatility({ classification: 'normal' }, '1h') }, '1h'),
      },
    });
    const result = applyMarketContextGate('SOLUSDT', 'LONG', btcAnalysis);
    expect(result.requireStrongerConfirmation).toBe(true);
    expect(result.forceInvalidate).toBe(false);
  });

  it('force-invalidates a vulnerable LONG on a strong BTC downside move', () => {
    // 4H downtrend + extreme 1H volatility + falling Open Interest -> strong down move
    const strongDown = makeSymbolAnalysis({
      symbol: 'BTCUSDT',
      timeframes: {
        '4h': makeTimeframe({ trend: makeTrend({ classification: 'downtrend', emaAlignment: 'bearish' }, '4h') }, '4h'),
        '1h': makeTimeframe({ volatility: makeVolatility({ classification: 'extreme' }, '1h') }, '1h'),
      },
      positioning: { oiTrend: 'falling' },
    });
    const result = applyMarketContextGate('SOLUSDT', 'LONG', strongDown);
    expect(result.forceInvalidate).toBe(true);
    expect(result.adjustment.effect).toBe('invalidated');
  });

  it('does not auto-approve a SHORT merely because BTC is in a downtrend', () => {
    const btcAnalysis = makeSymbolAnalysis({
      symbol: 'BTCUSDT',
      timeframes: {
        '4h': makeTimeframe({ trend: makeTrend({ classification: 'downtrend', emaAlignment: 'bearish' }, '4h') }, '4h'),
        '1h': makeTimeframe({ volatility: makeVolatility({ classification: 'normal' }, '1h') }, '1h'),
      },
    });
    const result = applyMarketContextGate('SOLUSDT', 'SHORT', btcAnalysis);
    expect(result.adjustment.applied).toBe(false);
    expect(result.requireStrongerConfirmation).toBe(false);
  });

  it('requires stronger confirmation for a SHORT when BTC is in a 4H uptrend', () => {
    const btcAnalysis = makeSymbolAnalysis({
      symbol: 'BTCUSDT',
      timeframes: {
        '4h': makeTimeframe({ trend: makeTrend({ classification: 'uptrend', emaAlignment: 'bullish' }, '4h') }, '4h'),
        '1h': makeTimeframe({ volatility: makeVolatility({ classification: 'normal' }, '1h') }, '1h'),
      },
    });
    const result = applyMarketContextGate('SOLUSDT', 'SHORT', btcAnalysis);
    expect(result.requireStrongerConfirmation).toBe(true);
  });
});
