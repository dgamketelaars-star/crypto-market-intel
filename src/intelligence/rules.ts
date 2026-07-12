/**
 * Thresholds for the intelligence/evidence layer, kept separate from
 * src/analysis/engine/rules.ts (the old engine's rules) and from
 * src/setups/engine/rules.ts (the paused setup engine's rules) so each
 * generation of rules stays independently auditable.
 */
export const INTEL_RULES = {
  regime: {
    /** Wilder's ADX >= this counts as a genuine trend, not just drift. */
    adxStrongThreshold: 25,
  },
  structure: {
    /** How many candles of "beyond the level" + "back inside" qualifies as a retest hold vs. a clean break. */
    retestLookback: 10,
    retestTolerancePct: 0.35,
  },
  entryLocation: {
    /** Price within this many ATR of a defensible zone counts as "at that zone" for entry-location-quality. */
    maxZoneDistanceAtrMult: 1.0,
  },
  volatility: {
    /** BB width squeeze lookback/percentile reused from the indicator's own defaults; extreme regime volatility cutoff mirrors the old engine's 'extreme' classification. */
  },
  volume: {
    breakoutConfirmMinRelativeVolume: 1.3,
  },
  marketContext: {
    /** How many of the Top-20 (excluding BTC/ETH) need to agree with BTC's regime bias to call the breadth "confirming". */
    breadthConfirmMinShare: 0.55,
    breadthOpposeMinShare: 0.55,
  },
  tradePlanning: {
    /**
     * Structural entry-zone width, as a fraction of the zone price — the
     * same tolerance used to cluster swing points into a zone in the first
     * place (see analysis/structure/supportResistance.ts's
     * zoneTouchToleragePct), not an arbitrary ATR pick.
     */
    entryZoneTolerancePct: 0.5,
    /**
     * ATR buffer added *beyond* the structural zone edge to absorb noise.
     * The structural edge (not this buffer) is the primary reference point
     * — but the buffer itself is deliberately set to 1.0x ATR, comfortably
     * above the 0.8x sanity floor below, rather than a smaller fraction
     * that would leave the stop sitting right at the floor's edge (the
     * paused setup engine hit exactly this floating-point-tie problem with
     * too small a buffer — see setups/engine/rules.ts's history).
     */
    stopAtrBufferMult: 1.0,
    /**
     * Price already beyond this many ATR from the entry zone at first
     * sight -> "entry missed, do not chase". Deliberately smaller than
     * entryLocation.maxZoneDistanceAtrMult (1.0x): that gate only asks "is
     * there a defensible zone within reach" for evidence purposes, this one
     * asks the stricter question "is the specific entry still realistically
     * reachable" once a concrete plan is being built.
     */
    maxMissedEntryAtrMult: 0.5,
    horizon: {
      dayTrade: {
        /** Stoploss must sit at least this many 1H ATR from entry — a sanity floor, not how the stop is placed. */
        minStopAtr1hMult: 0.8,
        minTargetAtr1hMult: 1.0,
      },
      swingTrade: {
        minStopAtr4hMult: 0.8,
        minTargetAtr4hMult: 1.0,
      },
    },
    rewardToRisk: {
      /** Minimum reward:risk for a target to survive. */
      minimum: 1.5,
    },
    /** Same "R:R that only looks big because the stop is tiny" sanity check as the paused engine's qualityGate.ts. */
    rrSanity: {
      reviewCeiling: 15,
      safeAtrRiskMult: 1.5,
    },
    /** A stop/target within this tolerance of a round number gets a stop-hunt-risk annotation — a proxy, not real liquidation data (see calculateRisk.ts). */
    roundNumberTolerancePct: 0.3,
  },
} as const;
