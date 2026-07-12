import { categoryEvidence, layerAGate } from '../../evidence/build';
import type { EvidenceLayers } from '../../evidence/types';
import type { MarketRegimeResult } from '../../regime/types';
import type { ThesisDirection, ValidThesis } from '../../thesis/types';
import type { ValidTradePlan } from '../../trade-planning/types';

export function makeEvidenceLayers(direction: ThesisDirection = 'LONG', overrides: Partial<EvidenceLayers> = {}): EvidenceLayers {
  const bias = direction === 'LONG' ? 'bullish' : 'bearish';
  const conclusion = bias;
  const layers: EvidenceLayers = {
    layerA: {
      marketRegime: layerAGate({ category: 'market_regime', gateStatus: 'usable', bias, conclusion, supporting: [{ description: 'Test regime reasoning.', timeframe: '1d', sourceTimestamp: 1 }], timeframe: 'multi', sourceTimestamp: 1 }),
      higherTimeframeStructure: layerAGate({ category: 'higher_timeframe_structure', gateStatus: 'usable', bias, conclusion, timeframe: 'multi', sourceTimestamp: 1 }),
      entryLocationQuality: {
        LONG: layerAGate({ category: 'entry_location_quality', gateStatus: direction === 'LONG' ? 'usable' : 'blocked', bias: direction === 'LONG' ? 'bullish' : 'neutral', conclusion: direction === 'LONG' ? 'bullish' : 'insufficient_data', timeframe: 'multi', sourceTimestamp: 1, blockedReason: direction === 'LONG' ? null : 'n/a' }),
        SHORT: layerAGate({ category: 'entry_location_quality', gateStatus: direction === 'SHORT' ? 'usable' : 'blocked', bias: direction === 'SHORT' ? 'bearish' : 'neutral', conclusion: direction === 'SHORT' ? 'bearish' : 'insufficient_data', timeframe: 'multi', sourceTimestamp: 1, blockedReason: direction === 'SHORT' ? null : 'n/a' }),
      },
    },
    layerB: {
      trend: categoryEvidence({ category: 'trend', conclusion, timeframe: '4h', sourceTimestamp: 1 }),
      momentum: categoryEvidence({ category: 'momentum', conclusion, timeframe: '4h', sourceTimestamp: 1 }),
      volume: categoryEvidence({ category: 'volume', conclusion, timeframe: '1h', sourceTimestamp: 1 }),
    },
    layerC: {
      volatility: categoryEvidence({ category: 'volatility', conclusion: 'neutral', timeframe: '4h', sourceTimestamp: 1 }),
      derivativesPositioning: categoryEvidence({ category: 'derivatives_positioning', conclusion: 'neutral', timeframe: 'multi', sourceTimestamp: 1 }),
      btcEthContext: categoryEvidence({ category: 'btc_eth_context', conclusion, timeframe: 'multi', sourceTimestamp: 1 }),
      riskConflict: categoryEvidence({ category: 'risk_conflict', conclusion: 'neutral', timeframe: 'multi', sourceTimestamp: 1 }),
    },
  };
  return { ...layers, ...overrides };
}

export function makeValidThesis(direction: ThesisDirection = 'LONG', overrides: Partial<ValidThesis> = {}): ValidThesis {
  const regime: MarketRegimeResult = { regime: direction === 'LONG' ? 'strong_uptrend' : 'strong_downtrend', bias: direction === 'LONG' ? 'bullish' : 'bearish', reasoning: ['Test reasoning.'] };
  return {
    outcome: direction === 'LONG' ? 'VALID_LONG_THESIS' : 'VALID_SHORT_THESIS',
    direction,
    layers: makeEvidenceLayers(direction),
    regime,
    contextAdjustments: [],
    signalStrength: 'High',
    narrative: 'Test narrative.',
    ...overrides,
  };
}

export function makeValidTradePlan(direction: ThesisDirection = 'LONG', overrides: Partial<ValidTradePlan> = {}): ValidTradePlan {
  const base: ValidTradePlan =
    direction === 'LONG'
      ? {
          outcome: 'VALID_PLAN',
          direction: 'LONG',
          horizon: 'DAY_TRADE',
          entryZone: { low: 99, high: 101 },
          trigger: { price: 100, timeframe: '1h', method: 'support-resistance-zone', explanation: 'Test support zone.' },
          invalidation: { price: 95, timeframe: '1h', method: 'structural-zone-edge-plus-atr-buffer', explanation: 'Test invalidation.' },
          targets: [
            { price: 110, timeframe: '1h', method: 'opposite-side-structural-zone', explanation: 'Test target 1.', rewardToRisk: 2, order: 1, positionPortionPct: 60, isFinal: false, status: 'pending' },
            { price: 120, timeframe: '1h', method: 'opposite-side-structural-zone', explanation: 'Test target 2.', rewardToRisk: 4, order: 2, positionPortionPct: 40, isFinal: true, status: 'pending' },
          ],
          risk: 'Medium',
          riskFactors: [],
        }
      : {
          outcome: 'VALID_PLAN',
          direction: 'SHORT',
          horizon: 'DAY_TRADE',
          entryZone: { low: 99, high: 101 },
          trigger: { price: 100, timeframe: '1h', method: 'support-resistance-zone', explanation: 'Test resistance zone.' },
          invalidation: { price: 105, timeframe: '1h', method: 'structural-zone-edge-plus-atr-buffer', explanation: 'Test invalidation.' },
          targets: [
            { price: 90, timeframe: '1h', method: 'opposite-side-structural-zone', explanation: 'Test target 1.', rewardToRisk: 2, order: 1, positionPortionPct: 60, isFinal: false, status: 'pending' },
            { price: 80, timeframe: '1h', method: 'opposite-side-structural-zone', explanation: 'Test target 2.', rewardToRisk: 4, order: 2, positionPortionPct: 40, isFinal: true, status: 'pending' },
          ],
          risk: 'Medium',
          riskFactors: [],
        };
  return { ...base, ...overrides };
}
