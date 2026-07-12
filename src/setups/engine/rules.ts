import type { VolumeClassification } from '../../analysis/engine/types';

/**
 * All setup-engine thresholds live here so every decision is auditable and
 * unit-testable independent of where the data came from.
 *
 * v6: setup generation moved from the family-pattern engine to the
 * intelligence/evidence pipeline (see src/intelligence/orchestrateSymbol.ts)
 * — the record shape and the logic that produces it both changed enough
 * that anything persisted under an older version must be discarded rather
 * than reinterpreted (see persistence/localStoragePersistence.ts).
 */
export const SETUP_RULE_VERSION = 'setup-rules-v6';

export const SETUP_RULES = {
  version: SETUP_RULE_VERSION,
  proximity: {
    /** Price within this many ATR of a trigger level counts as "near" -> waiting_for_confirmation instead of candidate. */
    triggerProximityAtrMult: 0.75,
  },
  atr: {
    /**
     * Raised from 0.5 to 1.0: lands right in the day trade's own preferred
     * 1.0–1.5x 1H ATR stop-distance range (see horizon.dayTrade below)
     * instead of sitting exactly on qualityGate's 0.8x floor, which used to
     * make every family's stop a knife-edge floating-point tie against the
     * validator. A stop this size is also comfortably real structure, not
     * "a few ticks from entry".
     */
    invalidationBufferMult: 1.0,
    /**
     * Raised from 1.5 to 2.5 alongside the invalidationBufferMult increase
     * above — at 1.5x target vs 1.0x stop, the "near" target's own R:R
     * (1.5) sat exactly on the new minimum (also 1.5) with zero margin, so
     * any real-world overshoot between the trigger and the live entry price
     * pushed it below the bar every time. 2.5x restores real headroom.
     */
    targetNearMult: 2.5,
    targetFarMult: 4,
    compressionTargetMult: 2.5,
    pullbackZoneMult: 1.0,
    rejectionConfirmationMult: 0.25,
    /** Price already beyond this many ATR from the trigger at first sight -> "entry missed, do not chase". */
    maxMissedEntryAtrMult: 1.0,
  },
  rewardToRisk: {
    /** Minimum reward:risk for Target 1 (and therefore every target — the level builders apply this to each candidate individually). Raised from 1.2 to 1.5: quality over quantity. */
    minimum: 1.5,
  },
  /**
   * Sanity check against reward:risk values that look impressive only
   * because the risk (denominator) is disproportionately tiny relative to
   * the reward — not because the plan is genuinely strong. This is not a
   * blanket R:R ceiling: a large, well-earned R:R with a proportionally
   * wide, ATR-justified stop is left alone. Only a target whose R:R clears
   * `reviewCeiling` *and* whose risk is still under `safeAtrRiskMult`
   * multiples of the relevant ATR (i.e. barely past the horizon's own
   * minimum stop-distance floor) is treated as mathematically inflated and
   * rejected. See qualityGate.ts.
   */
  rrSanity: {
    reviewCeiling: 15,
    safeAtrRiskMult: 1.5,
  },
  /**
   * Horizon-specific scale and distance rules — see tradeHorizon.ts for how
   * `dayTrade`/`swingTrade` reward bands classify a result, and
   * qualityGate.ts for how the stop/target multiples gate it once
   * classified. All multiples are deliberately expressed against the ATR of
   * the horizon's *own* timeframe (1H for day trades, 4H for swing trades)
   * so a swing stop can never be built mainly from 15m/1H noise.
   */
  horizon: {
    dayTrade: {
      /** Reward (trigger to furthest target) must be within [min, max) multiples of 1H ATR to classify as a day trade. */
      minRewardAtr1hMult: 1.0,
      maxRewardAtr1hMult: 8.0,
      /** Stoploss must sit at least this many 1H ATR from the trigger. */
      minStopAtr1hMult: 0.8,
      /** Each individual target must clear at least this many 1H ATR from the trigger to survive (not just the reward used for classification). */
      minTargetAtr1hMult: 1.0,
    },
    swingTrade: {
      /** Reward must be at least this many 1H ATR (large relative to intraday noise)... */
      minRewardAtr1hMult: 8.0,
      /** ...and at least this many 4H ATR (still meaningful on the higher timeframe, not just a big number on a small one). */
      minRewardAtr4hMult: 1.0,
      /** Stoploss must sit at least this many 4H ATR from the trigger — never derived mainly from 15m/1H noise. */
      minStopAtr4hMult: 0.8,
      minTargetAtr4hMult: 1.0,
    },
  },
  expiry: {
    /** A candidate/waiting setup that never confirms within this window expires. */
    maxOpenAgeMs: 48 * 60 * 60 * 1000,
  },
  compressionLookback: 20,
  conflict: {
    /** Net independent evidence groups a direction needs before it may activate at all. */
    minActivationScore: 2,
    /** The winning direction's net score must exceed the other by at least this much to count as "dominant". */
    dominanceMargin: 1,
  },
  targetPortions: {
    /** Staged-exit allocation per target count, keyed by 1H volatility — see targetPortions.ts for the full rule. */
    single: [100],
    two: { normal: [55, 45], elevated: [65, 35], extreme: [75, 25] },
    three: { normal: [35, 35, 30], elevated: [45, 35, 20], extreme: [55, 30, 15] },
  },
} as const;

/** Matches the analysis engine's "elevated"/"spike" relative-volume read. */
export function isVolumeConfirming(classification: VolumeClassification): boolean {
  return classification === 'elevated' || classification === 'spike';
}

/** Used when the market-context gate demands stronger-than-normal confirmation. */
export function isVolumeStronglyConfirming(classification: VolumeClassification): boolean {
  return classification === 'spike';
}
