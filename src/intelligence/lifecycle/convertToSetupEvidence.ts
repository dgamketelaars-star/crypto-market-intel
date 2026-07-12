import type { SetupEvidence } from '../../setups/engine/types';
import type { CategoryEvidence, EvidenceCategoryId, EvidenceFact, LayerACategoryEvidence } from '../evidence/types';
import type { ValidThesis } from '../thesis/types';

const CATEGORY_LABELS: Record<EvidenceCategoryId, string> = {
  market_regime: 'Market regime',
  higher_timeframe_structure: 'Higher-timeframe structure',
  entry_location_quality: 'Entry location',
  trend: 'Trend',
  momentum: 'Momentum',
  volume: 'Volume',
  volatility: 'Volatility',
  derivatives_positioning: 'Derivatives positioning',
  btc_eth_context: 'BTC/ETH context',
  risk_conflict: 'Risk / conflict',
};

const CATEGORY_GROUP: Record<EvidenceCategoryId, SetupEvidence['group']> = {
  market_regime: 'market_regime',
  higher_timeframe_structure: 'market_structure',
  entry_location_quality: 'market_structure',
  trend: 'trend',
  momentum: 'momentum',
  volume: 'volume',
  volatility: 'volatility',
  derivatives_positioning: 'futures_positioning',
  btc_eth_context: 'btc_eth_context',
  risk_conflict: 'risk_conflict',
};

function factsToEvidence(category: EvidenceCategoryId, facts: EvidenceFact[]): SetupEvidence[] {
  return facts.map((f) => ({ group: CATEGORY_GROUP[category], label: CATEGORY_LABELS[category], detail: f.description }));
}

/**
 * Flattens every evidence category's own supporting/opposing/missingData
 * facts (already gathered in Phase 2, one entry per concrete fact) into the
 * GeneratedSetup card's existing evidence-list shape — no re-deriving
 * support/opposition from the conclusion sign, the categories already did
 * that work explicitly.
 */
export function buildSetupEvidenceLists(thesis: ValidThesis): { supporting: SetupEvidence[]; opposing: SetupEvidence[]; missingData: SetupEvidence[] } {
  const direction = thesis.direction;
  const categories: [EvidenceCategoryId, CategoryEvidence | LayerACategoryEvidence][] = [
    ['market_regime', thesis.layers.layerA.marketRegime],
    ['higher_timeframe_structure', thesis.layers.layerA.higherTimeframeStructure],
    ['entry_location_quality', thesis.layers.layerA.entryLocationQuality[direction]],
    ['trend', thesis.layers.layerB.trend],
    ['momentum', thesis.layers.layerB.momentum],
    ['volume', thesis.layers.layerB.volume],
    ['volatility', thesis.layers.layerC.volatility],
    ['derivatives_positioning', thesis.layers.layerC.derivativesPositioning],
    ['btc_eth_context', thesis.layers.layerC.btcEthContext],
    ['risk_conflict', thesis.layers.layerC.riskConflict],
  ];

  const supporting: SetupEvidence[] = [];
  const opposing: SetupEvidence[] = [];
  const missingData: SetupEvidence[] = [];

  for (const [category, evidence] of categories) {
    supporting.push(...factsToEvidence(category, evidence.supporting));
    opposing.push(...factsToEvidence(category, evidence.opposing));
    missingData.push(...evidence.missingData.map((m) => ({ group: CATEGORY_GROUP[category], label: CATEGORY_LABELS[category], detail: m })));
  }

  return { supporting, opposing, missingData };
}
