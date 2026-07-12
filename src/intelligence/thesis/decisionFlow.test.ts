import { describe, expect, it } from 'vitest';
import { categoryEvidence, layerAGate } from '../evidence/build';
import type { EvidenceLayers, EvidenceConclusion } from '../evidence/types';
import type { EvidenceSynthesisResult } from '../evidence/synthesize';
import type { MarketRegimeResult } from '../regime/types';
import { decideThesis } from './decisionFlow';

const REGIME_BULLISH: MarketRegimeResult = { regime: 'strong_uptrend', bias: 'bullish', reasoning: ['test reasoning'] };

function baseLayers(overrides: Partial<EvidenceLayers> = {}): EvidenceLayers {
  const layers: EvidenceLayers = {
    layerA: {
      marketRegime: layerAGate({ category: 'market_regime', gateStatus: 'usable', bias: 'bullish', conclusion: 'bullish', timeframe: 'multi', sourceTimestamp: 1 }),
      higherTimeframeStructure: layerAGate({ category: 'higher_timeframe_structure', gateStatus: 'usable', bias: 'bullish', conclusion: 'bullish', timeframe: 'multi', sourceTimestamp: 1 }),
      entryLocationQuality: {
        LONG: layerAGate({ category: 'entry_location_quality', gateStatus: 'usable', bias: 'bullish', conclusion: 'bullish', timeframe: 'multi', sourceTimestamp: 1 }),
        SHORT: layerAGate({ category: 'entry_location_quality', gateStatus: 'blocked', bias: 'neutral', conclusion: 'insufficient_data', timeframe: 'multi', sourceTimestamp: 1, blockedReason: 'no short zone' }),
      },
    },
    layerB: {
      trend: categoryEvidence({ category: 'trend', conclusion: 'bullish', timeframe: '4h', sourceTimestamp: 1 }),
      momentum: categoryEvidence({ category: 'momentum', conclusion: 'bullish', timeframe: '4h', sourceTimestamp: 1 }),
      volume: categoryEvidence({ category: 'volume', conclusion: 'bullish', timeframe: '1h', sourceTimestamp: 1 }),
    },
    layerC: {
      volatility: categoryEvidence({ category: 'volatility', conclusion: 'neutral', timeframe: '4h', sourceTimestamp: 1 }),
      derivativesPositioning: categoryEvidence({ category: 'derivatives_positioning', conclusion: 'neutral', timeframe: 'multi', sourceTimestamp: 1 }),
      btcEthContext: categoryEvidence({ category: 'btc_eth_context', conclusion: 'bullish', timeframe: 'multi', sourceTimestamp: 1 }),
      riskConflict: categoryEvidence({ category: 'risk_conflict', conclusion: 'neutral', timeframe: 'multi', sourceTimestamp: 1 }),
    },
  };
  return { ...layers, ...overrides };
}

function baseSynthesis(overrides: Partial<EvidenceSynthesisResult> = {}): EvidenceSynthesisResult {
  return {
    layers: baseLayers(),
    regime: REGIME_BULLISH,
    provisionalBias: 'bullish',
    layerAConflicted: false,
    volatilityExtreme: false,
    ...overrides,
  };
}

function withLayerB(conclusions: [EvidenceConclusion, EvidenceConclusion, EvidenceConclusion]): EvidenceLayers {
  const layers = baseLayers();
  return {
    ...layers,
    layerB: {
      trend: { ...layers.layerB.trend, conclusion: conclusions[0] },
      momentum: { ...layers.layerB.momentum, conclusion: conclusions[1] },
      volume: { ...layers.layerB.volume, conclusion: conclusions[2] },
    },
  };
}

describe('decideThesis', () => {
  it('returns VALID_LONG_THESIS with High signal strength when Layer B is clean but derivatives is only neutral', () => {
    // Base fixture: all 3 Layer B agree, structure is strong, btcContext is bullish but derivatives is neutral —
    // "neutral" doesn't count as positively aligned, so this lands at High, not Very high.
    const result = decideThesis('SOLUSDT', baseSynthesis());
    expect(result.outcome).toBe('VALID_LONG_THESIS');
    if (result.outcome === 'VALID_LONG_THESIS') {
      expect(result.signalStrength).toBe('High');
      expect(result.narrative.length).toBeGreaterThan(0);
    }
  });

  it('returns Very high signal strength when Layer B and every Layer C category positively align', () => {
    const layers = baseLayers();
    layers.layerC.derivativesPositioning = { ...layers.layerC.derivativesPositioning, conclusion: 'slightly_bullish' };
    const result = decideThesis('SOLUSDT', baseSynthesis({ layers }));
    expect(result.outcome).toBe('VALID_LONG_THESIS');
    if (result.outcome === 'VALID_LONG_THESIS') expect(result.signalStrength).toBe('Very high');
  });

  it('returns NO THESIS when the market-regime gate is blocked', () => {
    const layers = baseLayers();
    layers.layerA.marketRegime = { ...layers.layerA.marketRegime, gateStatus: 'blocked', blockedReason: 'chaotic' };
    const result = decideThesis('SOLUSDT', baseSynthesis({ layers }));
    expect(result.outcome).toBe('NO_THESIS');
    if (result.outcome === 'NO_THESIS') expect(result.reason).toBe('regime_unusable');
  });

  it('returns NO THESIS when the HTF structure gate is blocked', () => {
    const layers = baseLayers();
    layers.layerA.higherTimeframeStructure = { ...layers.layerA.higherTimeframeStructure, gateStatus: 'blocked', blockedReason: 'conflicted' };
    const result = decideThesis('SOLUSDT', baseSynthesis({ layers }));
    expect(result.outcome).toBe('NO_THESIS');
    if (result.outcome === 'NO_THESIS') expect(result.reason).toBe('htf_structure_unclear');
  });

  it('returns NO THESIS when Layer A regime/structure directly conflict', () => {
    const result = decideThesis('SOLUSDT', baseSynthesis({ layerAConflicted: true, provisionalBias: 'neutral' }));
    expect(result.outcome).toBe('NO_THESIS');
    if (result.outcome === 'NO_THESIS') expect(result.reason).toBe('layer_a_conflict');
  });

  it('returns NO THESIS when regime and structure are both neutral (no directional foundation)', () => {
    const result = decideThesis('SOLUSDT', baseSynthesis({ provisionalBias: 'neutral' }));
    expect(result.outcome).toBe('NO_THESIS');
    if (result.outcome === 'NO_THESIS') expect(result.reason).toBe('no_directional_foundation');
  });

  it('returns NO THESIS when entry-location quality is blocked for the working direction', () => {
    // bias is bullish (LONG), and the LONG entry-location gate is blocked this time.
    const layers = baseLayers();
    layers.layerA.entryLocationQuality.LONG = { ...layers.layerA.entryLocationQuality.LONG, gateStatus: 'blocked', blockedReason: 'no support zone nearby' };
    const result = decideThesis('SOLUSDT', baseSynthesis({ layers }));
    expect(result.outcome).toBe('NO_THESIS');
    if (result.outcome === 'NO_THESIS') expect(result.reason).toBe('no_entry_location');
  });

  it('returns NO THESIS when two or more Layer B categories have insufficient data', () => {
    const layers = withLayerB(['insufficient_data', 'insufficient_data', 'bullish']);
    const result = decideThesis('SOLUSDT', baseSynthesis({ layers }));
    expect(result.outcome).toBe('NO_THESIS');
    if (result.outcome === 'NO_THESIS') expect(result.reason).toBe('insufficient_layer_b_confirmation');
  });

  it('returns NO THESIS when a Layer B category strongly opposes the bias', () => {
    const layers = withLayerB(['bullish', 'bearish', 'bullish']);
    const result = decideThesis('SOLUSDT', baseSynthesis({ layers }));
    expect(result.outcome).toBe('NO_THESIS');
    if (result.outcome === 'NO_THESIS') expect(result.reason).toBe('layer_b_strong_contradiction');
  });

  it('returns NO THESIS when fewer than 2 of 3 Layer B categories agree', () => {
    const layers = withLayerB(['bullish', 'neutral', 'neutral']);
    const result = decideThesis('SOLUSDT', baseSynthesis({ layers }));
    expect(result.outcome).toBe('NO_THESIS');
    if (result.outcome === 'NO_THESIS') expect(result.reason).toBe('insufficient_layer_b_confirmation');
  });

  it('accepts exactly 2-of-3 Layer B agreement (with the third neutral) as Medium strength', () => {
    const layers = withLayerB(['bullish', 'bullish', 'neutral']);
    const result = decideThesis('SOLUSDT', baseSynthesis({ layers }));
    expect(result.outcome).toBe('VALID_LONG_THESIS');
    if (result.outcome === 'VALID_LONG_THESIS') expect(result.signalStrength).toBe('Medium');
  });

  it('raises the Layer B bar to 3-of-3 and rejects when volatility is extreme and only 2 of 3 agree', () => {
    const layers = withLayerB(['bullish', 'bullish', 'neutral']);
    const result = decideThesis('SOLUSDT', baseSynthesis({ layers, volatilityExtreme: true }));
    expect(result.outcome).toBe('NO_THESIS');
    if (result.outcome === 'NO_THESIS') expect(result.reason).toBe('insufficient_layer_b_confirmation');
  });

  it('accepts a thesis under extreme volatility when all 3 Layer B categories agree, capped at Medium strength', () => {
    const result = decideThesis('SOLUSDT', baseSynthesis({ volatilityExtreme: true }));
    expect(result.outcome).toBe('VALID_LONG_THESIS');
    if (result.outcome === 'VALID_LONG_THESIS') expect(result.signalStrength).toBe('Medium');
  });

  it('vetoes when BTC/ETH context strongly opposes the direction', () => {
    const layers = baseLayers();
    layers.layerC.btcEthContext = { ...layers.layerC.btcEthContext, conclusion: 'bearish' };
    const result = decideThesis('SOLUSDT', baseSynthesis({ layers }));
    expect(result.outcome).toBe('NO_THESIS');
    if (result.outcome === 'NO_THESIS') expect(result.reason).toBe('layer_c_veto');
  });

  it('vetoes on the risk_conflict circuit breaker (unresolved opposing evidence)', () => {
    const layers = baseLayers();
    layers.layerC.riskConflict = { ...layers.layerC.riskConflict, conclusion: 'conflicted' };
    const result = decideThesis('SOLUSDT', baseSynthesis({ layers }));
    expect(result.outcome).toBe('NO_THESIS');
    if (result.outcome === 'NO_THESIS') expect(result.reason).toBe('unresolved_opposing_evidence');
  });

  it('resolves a SHORT thesis symmetrically when the bias is bearish', () => {
    const layers = baseLayers();
    layers.layerA.marketRegime = { ...layers.layerA.marketRegime, bias: 'bearish', conclusion: 'bearish' };
    layers.layerA.higherTimeframeStructure = { ...layers.layerA.higherTimeframeStructure, bias: 'bearish', conclusion: 'bearish' };
    layers.layerA.entryLocationQuality = {
      LONG: { ...layers.layerA.entryLocationQuality.SHORT, gateStatus: 'blocked', blockedReason: 'no long zone' },
      SHORT: layerAGate({ category: 'entry_location_quality', gateStatus: 'usable', bias: 'bearish', conclusion: 'bearish', timeframe: 'multi', sourceTimestamp: 1 }),
    };
    layers.layerB = {
      trend: categoryEvidence({ category: 'trend', conclusion: 'bearish', timeframe: '4h', sourceTimestamp: 1 }),
      momentum: categoryEvidence({ category: 'momentum', conclusion: 'bearish', timeframe: '4h', sourceTimestamp: 1 }),
      volume: categoryEvidence({ category: 'volume', conclusion: 'bearish', timeframe: '1h', sourceTimestamp: 1 }),
    };
    layers.layerC.btcEthContext = { ...layers.layerC.btcEthContext, conclusion: 'bearish' };
    const result = decideThesis('SOLUSDT', baseSynthesis({ layers, regime: { regime: 'strong_downtrend', bias: 'bearish', reasoning: ['test'] }, provisionalBias: 'bearish' }));
    expect(result.outcome).toBe('VALID_SHORT_THESIS');
  });

  it('never returns both a LONG and SHORT thesis simultaneously — only one outcome value', () => {
    const result = decideThesis('SOLUSDT', baseSynthesis());
    const outcomes = ['VALID_LONG_THESIS', 'VALID_SHORT_THESIS', 'NO_THESIS'];
    expect(outcomes.filter((o) => o === result.outcome)).toHaveLength(1);
  });
});
