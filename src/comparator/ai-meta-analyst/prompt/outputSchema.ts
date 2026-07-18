/**
 * JSON schema passed as output_config.format on the Messages API call, so
 * System E's response is guaranteed-valid JSON matching this shape rather
 * than free text we'd have to parse — see analysis/runMetaAnalysis.ts.
 * Mirrors the five mandatory blocks from the brief: consensus, independent
 * analysis, comparison, final decision, motivation.
 */
export const SYSTEM_E_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    consensusSummary: {
      type: 'string',
      description: 'Block 1: objective synthesis only — no opinion yet. What do systems A-D agree on, where do they differ, which arguments repeat, which contradict.',
    },
    consensusAgreements: { type: 'array', items: { type: 'string' } },
    consensusDisagreements: { type: 'array', items: { type: 'string' } },
    independentAnalysis: {
      type: 'string',
      description: 'Block 2: your own fully independent read of the raw Binance data, as if A-D do not exist. Cover trend, structure, support/resistance, higher timeframe context, risk/reward, market context.',
    },
    tradeLocationAssessment: {
      type: 'string',
      description: 'Explicit, separate answer to "is NOW a good place to open a trade" — distinct from "will price probably go up/down".',
    },
    sharedBlindSpotWarning: {
      type: ['string', 'null'],
      description: 'If multiple systems independently show signs of the same mistake (chasing the move, ignoring resistance, missing higher-timeframe context, uniform excessive bullishness/bearishness), name it explicitly here. Null if you see no such pattern — do not invent one to fill the field.',
    },
    comparison: {
      type: 'string',
      description: 'Block 3: where your independent analysis agrees with the A-D consensus, where it diverges, and exactly why.',
    },
    finalDecision: { type: 'string', enum: ['LONG', 'SHORT', 'WAIT', 'NO_TRADE'] },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    confidenceReasoning: {
      type: 'string',
      description: 'Required. Explain the confidence level in plain language tied to specific evidence — never a bare number or label with no reasoning attached.',
    },
    followsConsensus: {
      type: 'string',
      enum: ['follows', 'partially_follows', 'diverges'],
      description: 'Whether the final decision follows the A-D consensus, partially follows it, or deliberately diverges from it.',
    },
    motivation: {
      type: 'string',
      description: 'Block 5: full motivation for the final decision. Why this decision, what risks you see, why you are or are not following the consensus.',
    },
    riskFactors: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'consensusSummary',
    'consensusAgreements',
    'consensusDisagreements',
    'independentAnalysis',
    'tradeLocationAssessment',
    'sharedBlindSpotWarning',
    'comparison',
    'finalDecision',
    'confidence',
    'confidenceReasoning',
    'followsConsensus',
    'motivation',
    'riskFactors',
  ],
  additionalProperties: false,
} as const;

export type SystemEFinalDecision = 'LONG' | 'SHORT' | 'WAIT' | 'NO_TRADE';
export type SystemEConfidence = 'low' | 'medium' | 'high';
export type SystemEConsensusRelation = 'follows' | 'partially_follows' | 'diverges';

export interface SystemEAnalysisResult {
  consensusSummary: string;
  consensusAgreements: string[];
  consensusDisagreements: string[];
  independentAnalysis: string;
  tradeLocationAssessment: string;
  sharedBlindSpotWarning: string | null;
  comparison: string;
  finalDecision: SystemEFinalDecision;
  confidence: SystemEConfidence;
  confidenceReasoning: string;
  followsConsensus: SystemEConsensusRelation;
  motivation: string;
  riskFactors: string[];
}
