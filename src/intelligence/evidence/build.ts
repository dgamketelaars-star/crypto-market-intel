import type { CandleInterval } from '../../services/binance/types';
import type { CategoryEvidence, EvidenceCategoryId, EvidenceConclusion, EvidenceFact, LayerACategoryEvidence, LayerAGateStatus } from './types';

export function fact(description: string, timeframe: CandleInterval | 'multi' | null, sourceTimestamp: number): EvidenceFact {
  return { description, timeframe, sourceTimestamp };
}

export function categoryEvidence(params: {
  category: EvidenceCategoryId;
  conclusion: EvidenceConclusion;
  supporting?: EvidenceFact[];
  opposing?: EvidenceFact[];
  missingData?: string[];
  timeframe: CandleInterval | 'multi' | null;
  sourceTimestamp: number;
}): CategoryEvidence {
  return {
    category: params.category,
    conclusion: params.conclusion,
    supporting: params.supporting ?? [],
    opposing: params.opposing ?? [],
    missingData: params.missingData ?? [],
    timeframe: params.timeframe,
    sourceTimestamp: params.sourceTimestamp,
  };
}

export function insufficientData(category: EvidenceCategoryId, timeframe: CandleInterval | 'multi' | null, sourceTimestamp: number, missing: string[]): CategoryEvidence {
  return categoryEvidence({ category, conclusion: 'insufficient_data', timeframe, sourceTimestamp, missingData: missing });
}

export function layerAGate(params: {
  category: EvidenceCategoryId;
  gateStatus: LayerAGateStatus;
  bias: 'bullish' | 'bearish' | 'neutral';
  conclusion: EvidenceConclusion;
  supporting?: EvidenceFact[];
  opposing?: EvidenceFact[];
  missingData?: string[];
  timeframe: CandleInterval | 'multi' | null;
  sourceTimestamp: number;
  blockedReason?: string | null;
}): LayerACategoryEvidence {
  return {
    category: params.category,
    conclusion: params.conclusion,
    supporting: params.supporting ?? [],
    opposing: params.opposing ?? [],
    missingData: params.missingData ?? [],
    timeframe: params.timeframe,
    sourceTimestamp: params.sourceTimestamp,
    gateStatus: params.gateStatus,
    bias: params.bias,
    blockedReason: params.blockedReason ?? null,
  };
}

export function blockedGate(category: EvidenceCategoryId, timeframe: CandleInterval | 'multi' | null, sourceTimestamp: number, reason: string): LayerACategoryEvidence {
  return layerAGate({
    category,
    gateStatus: 'blocked',
    bias: 'neutral',
    conclusion: 'insufficient_data',
    timeframe,
    sourceTimestamp,
    blockedReason: reason,
  });
}
