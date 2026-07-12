import type { FamilyResult } from '../families/shared';
import type { EntryInfo, GeneratedSetup, SetupChangeLog, SetupLevel, SetupTarget, SetupTargetCandidate } from '../engine/types';
import { SETUP_RULE_VERSION } from '../engine/rules';

const NOW = 1_700_000_000_000;

export function makeLevel(overrides: Partial<SetupLevel> = {}): SetupLevel {
  return { price: 100, timeframe: '1h', method: 'test method', explanation: 'test explanation', ...overrides };
}

export function makeTargetCandidate(overrides: Partial<SetupTargetCandidate> = {}): SetupTargetCandidate {
  return { ...makeLevel({ price: 130 }), rewardToRisk: 2, ...overrides };
}

export function makeTarget(overrides: Partial<SetupTarget> = {}): SetupTarget {
  return {
    ...makeLevel({ price: 130 }),
    rewardToRisk: 2,
    order: 1,
    positionPortionPct: 100,
    isFinal: true,
    status: 'pending',
    ...overrides,
  };
}

export function makeChangeLog(overrides: Partial<SetupChangeLog> = {}): SetupChangeLog {
  return { entryZone: null, invalidation: null, targets: null, ...overrides };
}

export function makeEntry(overrides: Partial<EntryInfo> = {}): EntryInfo {
  return {
    activatedAt: NOW,
    triggerPrice: 110,
    firstLivePrice: 110,
    entryZone: null,
    highestFavorableExcursion: 110,
    largestAdverseExcursion: 110,
    entryMissed: false,
    ...overrides,
  };
}

export function makeFamilyResult(overrides: Partial<FamilyResult> = {}): FamilyResult {
  return {
    direction: 'LONG',
    family: 'trend_continuation_breakout',
    readiness: 'candidate',
    trigger: makeLevel({ price: 110 }),
    invalidation: makeLevel({ price: 95 }),
    entryZone: null,
    targets: [makeTargetCandidate()],
    supporting: [{ group: 'trend', label: 'Trend', detail: 'Uptrend' }],
    opposing: [],
    missingData: [],
    atr: 2,
    ...overrides,
  };
}

export function makeGeneratedSetup(overrides: Partial<GeneratedSetup> = {}): GeneratedSetup {
  return {
    id: 'TESTUSDT-trend_continuation_breakout-LONG-1',
    symbol: 'TESTUSDT',
    direction: 'LONG',
    family: 'trend_continuation_breakout',
    status: 'active',
    createdAt: NOW,
    lastEvaluatedAt: NOW,
    tradeHorizon: 'DAY_TRADE',
    expectedDuration: '1-3 dagen',
    signalStrength: 'Medium',
    risk: 'Medium',
    trigger: makeLevel({ price: 110 }),
    invalidation: makeLevel({ price: 95 }),
    entryZone: null,
    targets: [makeTarget()],
    supporting: [{ group: 'trend', label: 'Trend', detail: 'Uptrend' }],
    opposing: [],
    missingData: [],
    marketContext: { applied: false, reason: 'Geen BTC-contextaanpassing van toepassing.', effect: 'none' },
    ruleVersion: SETUP_RULE_VERSION,
    sourceDataTimestamps: { symbol: NOW, btc: null },
    lifecycle: [{ timestamp: NOW, type: 'candidate_created', detail: 'created' }],
    origin: 'live',
    closedAt: null,
    closedReason: null,
    closedPrice: null,
    entry: makeEntry(),
    directionRejection: null,
    changeLog: makeChangeLog(),
    ...overrides,
  };
}

export const FIXTURE_NOW = NOW;
