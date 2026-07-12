import { describe, expect, it } from 'vitest';
import { makeTrend, makeVolume } from '../../setups/testUtils/analysisFixtures';
import { makeCandle } from '../../analysis/testUtils/fixtures';

import { evaluateVolume } from './evaluateVolume';

function risingVolumeCandles(): ReturnType<typeof makeCandle>[] {
  return Array.from({ length: 25 }, (_, i) => makeCandle({ close: 100 + i, volume: 50 + i * 5 }, i));
}

function fallingPriceElevatedVolumeCandles(): ReturnType<typeof makeCandle>[] {
  return Array.from({ length: 25 }, (_, i) => makeCandle({ close: 150 - i, volume: 50 + i * 5 }, i));
}

describe('evaluateVolume', () => {
  it('returns insufficient_data when the volume analysis is not sufficient', () => {
    const volume = makeVolume({ sufficientData: false, classification: 'insufficient_data' });
    expect(evaluateVolume(volume, undefined, [], 1).conclusion).toBe('insufficient_data');
  });

  it('concludes bullish for elevated volume accompanying a rising price with confirming OBV', () => {
    const volume = makeVolume({ classification: 'elevated' });
    const trend = makeTrend({ emaSlope20Pct: 2 }, '1h');
    const result = evaluateVolume(volume, trend, risingVolumeCandles(), 1);
    expect(result.conclusion).toBe('bullish');
  });

  it('concludes bearish for elevated volume accompanying a falling price with confirming OBV', () => {
    const volume = makeVolume({ classification: 'spike' });
    const trend = makeTrend({ emaSlope20Pct: -2 }, '1h');
    const result = evaluateVolume(volume, trend, fallingPriceElevatedVolumeCandles(), 1);
    expect(result.conclusion).toBe('bearish');
  });

  it('concludes neutral when volume is normal and there is no clear price direction', () => {
    const volume = makeVolume({ classification: 'normal' });
    const trend = makeTrend({ emaSlope20Pct: 0 }, '1h');
    const result = evaluateVolume(volume, trend, risingVolumeCandles(), 1);
    expect(result.conclusion).toBe('neutral');
  });
});
