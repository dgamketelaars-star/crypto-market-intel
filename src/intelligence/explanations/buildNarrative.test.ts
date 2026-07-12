import { describe, expect, it } from 'vitest';
import { categoryEvidence, fact, layerAGate } from '../evidence/build';
import type { EvidenceLayers } from '../evidence/types';
import type { MarketRegimeResult } from '../regime/types';
import { buildThesisNarrative } from './buildNarrative';

function makeLayers(): EvidenceLayers {
  return {
    layerA: {
      marketRegime: layerAGate({ category: 'market_regime', gateStatus: 'usable', bias: 'bullish', conclusion: 'bullish', timeframe: 'multi', sourceTimestamp: 1 }),
      higherTimeframeStructure: layerAGate({
        category: 'higher_timeframe_structure',
        gateStatus: 'usable',
        bias: 'bullish',
        conclusion: 'bullish',
        supporting: [fact('1D structure event: bullish_bos at 116.', '1d', 1)],
        timeframe: '1d',
        sourceTimestamp: 1,
      }),
      entryLocationQuality: {
        LONG: layerAGate({
          category: 'entry_location_quality',
          gateStatus: 'usable',
          bias: 'bullish',
          conclusion: 'bullish',
          supporting: [fact('Support zone at 100.0000 (2 touches).', 'multi', 1)],
          timeframe: 'multi',
          sourceTimestamp: 1,
        }),
        SHORT: layerAGate({ category: 'entry_location_quality', gateStatus: 'blocked', bias: 'neutral', conclusion: 'insufficient_data', timeframe: 'multi', sourceTimestamp: 1, blockedReason: 'n/a' }),
      },
    },
    layerB: {
      trend: categoryEvidence({ category: 'trend', conclusion: 'bullish', timeframe: '4h', sourceTimestamp: 1 }),
      momentum: categoryEvidence({ category: 'momentum', conclusion: 'bullish', timeframe: '4h', sourceTimestamp: 1 }),
      volume: categoryEvidence({ category: 'volume', conclusion: 'neutral', timeframe: '1h', sourceTimestamp: 1 }),
    },
    layerC: {
      volatility: categoryEvidence({ category: 'volatility', conclusion: 'neutral', timeframe: '4h', sourceTimestamp: 1 }),
      derivativesPositioning: categoryEvidence({ category: 'derivatives_positioning', conclusion: 'neutral', timeframe: 'multi', sourceTimestamp: 1 }),
      btcEthContext: categoryEvidence({ category: 'btc_eth_context', conclusion: 'bullish', timeframe: 'multi', sourceTimestamp: 1 }),
      riskConflict: categoryEvidence({ category: 'risk_conflict', conclusion: 'neutral', timeframe: 'multi', sourceTimestamp: 1 }),
    },
  };
}

const regime: MarketRegimeResult = { regime: 'strong_uptrend', bias: 'bullish', reasoning: ['ADX(30.0) on 1D — strong trend strength.'] };

describe('buildThesisNarrative', () => {
  it('produces a non-empty narrative that references the symbol, direction and signal strength', () => {
    const narrative = buildThesisNarrative({
      symbol: 'SOLUSDT',
      direction: 'LONG',
      regime,
      layers: makeLayers(),
      signalStrength: 'High',
      contextAdjustments: [],
    });
    expect(narrative).toContain('SOLUSDT');
    expect(narrative).toContain('Signal strength: High');
    expect(narrative.toLowerCase()).toContain('not a trading signal');
  });

  it('includes the structure and entry-location supporting facts verbatim', () => {
    const narrative = buildThesisNarrative({
      symbol: 'SOLUSDT',
      direction: 'LONG',
      regime,
      layers: makeLayers(),
      signalStrength: 'High',
      contextAdjustments: [],
    });
    expect(narrative).toContain('bullish_bos at 116');
    expect(narrative).toContain('Support zone at 100.0000');
  });

  it('includes context adjustments when present', () => {
    const narrative = buildThesisNarrative({
      symbol: 'SOLUSDT',
      direction: 'LONG',
      regime,
      layers: makeLayers(),
      signalStrength: 'Medium',
      contextAdjustments: ['Extreme volatility raised the required Layer B confirmation to 3-of-3'],
    });
    expect(narrative).toContain('Context notes:');
    expect(narrative).toContain('Extreme volatility raised the required Layer B confirmation to 3-of-3');
  });
});
