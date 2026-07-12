import { describe, expect, it } from 'vitest';
import { categoryEvidence, layerAGate } from '../evidence/build';
import { calculateSignalStrength } from './signalStrength';

const structureStrongBullish = layerAGate({ category: 'higher_timeframe_structure', gateStatus: 'usable', bias: 'bullish', conclusion: 'bullish', timeframe: 'multi', sourceTimestamp: 1 });
const structureSlightBullish = layerAGate({ category: 'higher_timeframe_structure', gateStatus: 'usable', bias: 'bullish', conclusion: 'slightly_bullish', timeframe: 'multi', sourceTimestamp: 1 });

function bullish(category: 'trend' | 'momentum' | 'volume' | 'derivatives_positioning' | 'btc_eth_context') {
  return categoryEvidence({ category, conclusion: 'bullish', timeframe: 'multi', sourceTimestamp: 1 });
}
function neutral(category: 'trend' | 'momentum' | 'volume' | 'derivatives_positioning' | 'btc_eth_context') {
  return categoryEvidence({ category, conclusion: 'neutral', timeframe: 'multi', sourceTimestamp: 1 });
}

describe('calculateSignalStrength', () => {
  it('caps at Medium when tightening was applied, even with a clean setup otherwise', () => {
    const result = calculateSignalStrength({
      direction: 'LONG',
      structureEvidence: structureStrongBullish,
      layerBCategories: [bullish('trend'), bullish('momentum'), bullish('volume')],
      layerCCategories: [bullish('derivatives_positioning'), bullish('btc_eth_context')],
      tighteningApplied: true,
    });
    expect(result).toBe('Medium');
  });

  it('caps at Medium when structure is only slightly bullish, not fully bullish', () => {
    const result = calculateSignalStrength({
      direction: 'LONG',
      structureEvidence: structureSlightBullish,
      layerBCategories: [bullish('trend'), bullish('momentum'), bullish('volume')],
      layerCCategories: [bullish('derivatives_positioning'), bullish('btc_eth_context')],
      tighteningApplied: false,
    });
    expect(result).toBe('Medium');
  });

  it('is High when Layer B is 3-of-3 and structure is strong but Layer C is only neutral', () => {
    const result = calculateSignalStrength({
      direction: 'LONG',
      structureEvidence: structureStrongBullish,
      layerBCategories: [bullish('trend'), bullish('momentum'), bullish('volume')],
      layerCCategories: [neutral('derivatives_positioning'), neutral('btc_eth_context')],
      tighteningApplied: false,
    });
    expect(result).toBe('High');
  });

  it('is Very high when Layer B is 3-of-3, structure is strong, and Layer C positively aligns', () => {
    const result = calculateSignalStrength({
      direction: 'LONG',
      structureEvidence: structureStrongBullish,
      layerBCategories: [bullish('trend'), bullish('momentum'), bullish('volume')],
      layerCCategories: [bullish('derivatives_positioning'), bullish('btc_eth_context')],
      tighteningApplied: false,
    });
    expect(result).toBe('Very high');
  });
});
