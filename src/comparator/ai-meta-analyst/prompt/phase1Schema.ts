import { CONFIDENCE_ENUM, DECISION_ENUM, NUMBER_LIST_SCHEMA, SETUP_QUALITY_ENUM, STRING_LIST_SCHEMA, TARGET_LIST_SCHEMA, ZONE_SCHEMA } from './schemaFragments';
import type { SetupQuality } from './setupQuality';

/**
 * Phase 1 — System E's fully independent read, produced BEFORE it is shown
 * any output from Systems A-D (see prompt/phase1Prompt.ts and Deel 4 of the
 * brief). Stored verbatim on the record alongside the phase 2 result so the
 * two can be compared later without either overwriting the other —
 * anchoring prevention only works if this conclusion is locked in first.
 */
export const SYSTEM_E_PHASE1_SCHEMA = {
  type: 'object',
  properties: {
    marketRegime: { type: 'string', description: 'Trend / range / consolidation / expansion characterization, in your own words.' },
    higherTimeframeDirection: { type: 'string' },
    shortTermStructure: { type: 'string' },
    momentum: { type: 'string' },
    supportLevels: NUMBER_LIST_SCHEMA,
    resistanceLevels: NUMBER_LIST_SCHEMA,
    tradeLocationAssessment: {
      type: 'string',
      description: 'Explicit, separate answer to "is NOW a good place to open a trade" — distinct from "will price probably go up/down".',
    },
    setupQuality: { type: 'string', enum: SETUP_QUALITY_ENUM, description: 'A+/A/B are tradeable (LONG or SHORT). C normally means WAIT. D means NO_TRADE.' },
    decision: { type: 'string', enum: DECISION_ENUM },
    confidence: { type: 'string', enum: CONFIDENCE_ENUM },
    entryZone: ZONE_SCHEMA,
    invalidation: { type: ['number', 'null'] },
    targets: TARGET_LIST_SCHEMA,
    riskRewardRatio: { type: ['number', 'null'] },
    argumentsFor: STRING_LIST_SCHEMA,
    argumentsAgainst: STRING_LIST_SCHEMA,
    waitConditions: {
      ...STRING_LIST_SCHEMA,
      description: 'Required when decision is WAIT: the concrete, checkable condition(s) that would turn this into a trade (e.g. "breakout above X", "successful retest of Y"). Empty array otherwise.',
    },
    rejectionCheck: {
      type: 'string',
      description:
        'Required when decision is WAIT or NO_TRADE: your explicit reasoning through the five mandatory counter-questions (is there an imperfect-but-valid B setup; is the risk truly unacceptable or merely present; would a rational day trader really have to skip this; is the location bad or just not ideal; is a concrete entry with clear invalidation possible). Empty string when the decision is LONG or SHORT.',
    },
  },
  required: [
    'marketRegime',
    'higherTimeframeDirection',
    'shortTermStructure',
    'momentum',
    'supportLevels',
    'resistanceLevels',
    'tradeLocationAssessment',
    'setupQuality',
    'decision',
    'confidence',
    'entryZone',
    'invalidation',
    'targets',
    'riskRewardRatio',
    'argumentsFor',
    'argumentsAgainst',
    'waitConditions',
    'rejectionCheck',
  ],
  additionalProperties: false,
} as const;

export type SystemEDecision = (typeof DECISION_ENUM)[number];
export type SystemEConfidence = (typeof CONFIDENCE_ENUM)[number];

export interface SystemEZone {
  low: number;
  high: number;
}

export interface SystemETarget {
  price: number;
  reason: string;
}

export interface SystemEPhase1Result {
  marketRegime: string;
  higherTimeframeDirection: string;
  shortTermStructure: string;
  momentum: string;
  supportLevels: number[];
  resistanceLevels: number[];
  tradeLocationAssessment: string;
  setupQuality: SetupQuality;
  decision: SystemEDecision;
  confidence: SystemEConfidence;
  entryZone: SystemEZone | null;
  invalidation: number | null;
  targets: SystemETarget[];
  riskRewardRatio: number | null;
  argumentsFor: string[];
  argumentsAgainst: string[];
  waitConditions: string[];
  rejectionCheck: string;
}
