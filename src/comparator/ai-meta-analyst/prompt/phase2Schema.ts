import { CONFIDENCE_ENUM, DECISION_ENUM, SETUP_QUALITY_ENUM, STRING_LIST_SCHEMA, TARGET_LIST_SCHEMA, ZONE_SCHEMA } from './schemaFragments';
import type { SystemEConfidence, SystemEDecision, SystemETarget, SystemEZone } from './phase1Schema';
import type { SetupQuality } from './setupQuality';

/**
 * Phase 2 — produced AFTER phase 1 is locked in and System E is shown the
 * published output of Systems A-D. May revise phase 1's decision/confidence,
 * but only with reasoning tied to what A-D actually published — never by
 * counting votes or averaging directions (see phase2Prompt.ts's hard rules).
 */
export const SYSTEM_E_PHASE2_SCHEMA = {
  type: 'object',
  properties: {
    adSummary: {
      type: 'string',
      description: 'Objective synthesis of the published A-D output only — no opinion yet. Use methodologically careful wording: describe what each system\'s PUBLISHED OUTPUT does or does not show, never claim to know what a system "ignored" or "failed to consider" internally.',
    },
    adAgreements: STRING_LIST_SCHEMA,
    adDisagreements: STRING_LIST_SCHEMA,
    adMissingSystems: { ...STRING_LIST_SCHEMA, description: 'Systems (by name) that currently have no active setup for this symbol.' },
    adLevelDifferences: { ...STRING_LIST_SCHEMA, description: 'Concrete differences in entry, stop, or target levels across the systems that do have a setup.' },
    sharedBlindSpotWarning: {
      type: ['string', 'null'],
      description: 'If the published outputs of multiple systems independently show signs of the same mistake (chasing the move, not weighing a nearby resistance, missing higher-timeframe context, uniform bullishness/bearishness), name it here — phrased as "not reflected in the published output", never as a claim about what a system internally computed. Null if there is no such pattern; do not invent one.',
    },
    comparisonToPhase1: {
      type: 'string',
      description: 'Where your independent phase-1 analysis matched the A-D consensus, where it diverged, and — critically — which SPECIFIC piece of A-D information (if any) changed your view. Not a vote count.',
    },
    phase1DirectionRetained: { type: 'boolean', description: 'True if the final decision keeps phase 1\'s direction/decision; false if this phase revised it.' },
    finalDecision: { type: 'string', enum: DECISION_ENUM },
    finalConfidence: { type: 'string', enum: CONFIDENCE_ENUM },
    finalSetupQuality: { type: 'string', enum: SETUP_QUALITY_ENUM },
    finalEntryZone: ZONE_SCHEMA,
    finalInvalidation: { type: ['number', 'null'] },
    finalTargets: TARGET_LIST_SCHEMA,
    finalRiskRewardRatio: { type: ['number', 'null'] },
    edgeSummary: { type: 'string', description: 'The single most important edge for this trade, in one or two sentences. Empty-ish/minimal if finalDecision is WAIT or NO_TRADE.' },
    keyRisk: { type: 'string', description: 'The single most important risk.' },
    invalidationCondition: { type: 'string', description: 'What would make this decision wrong / no longer valid.' },
    waitConditions: {
      ...STRING_LIST_SCHEMA,
      description: 'Required when finalDecision is WAIT: concrete, checkable confirmation condition(s) (e.g. "breakout above X", "confirmed retest of Y", "volume pickup"). Empty array otherwise.',
    },
    motivation: {
      type: 'string',
      description: 'Full professional motivation for the final decision: why this decision, why you are or are not following systems A-D, and (if diverging) exactly why.',
    },
  },
  required: [
    'adSummary',
    'adAgreements',
    'adDisagreements',
    'adMissingSystems',
    'adLevelDifferences',
    'sharedBlindSpotWarning',
    'comparisonToPhase1',
    'phase1DirectionRetained',
    'finalDecision',
    'finalConfidence',
    'finalSetupQuality',
    'finalEntryZone',
    'finalInvalidation',
    'finalTargets',
    'finalRiskRewardRatio',
    'edgeSummary',
    'keyRisk',
    'invalidationCondition',
    'waitConditions',
    'motivation',
  ],
  additionalProperties: false,
} as const;

export interface SystemEPhase2Result {
  adSummary: string;
  adAgreements: string[];
  adDisagreements: string[];
  adMissingSystems: string[];
  adLevelDifferences: string[];
  sharedBlindSpotWarning: string | null;
  comparisonToPhase1: string;
  phase1DirectionRetained: boolean;
  finalDecision: SystemEDecision;
  finalConfidence: SystemEConfidence;
  finalSetupQuality: SetupQuality;
  finalEntryZone: SystemEZone | null;
  finalInvalidation: number | null;
  finalTargets: SystemETarget[];
  finalRiskRewardRatio: number | null;
  edgeSummary: string;
  keyRisk: string;
  invalidationCondition: string;
  waitConditions: string[];
  motivation: string;
}
