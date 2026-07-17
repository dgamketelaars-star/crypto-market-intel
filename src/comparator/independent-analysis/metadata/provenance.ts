/**
 * Code Provenance record for System C (see the Independent Open-Source
 * Market-Analysis Architecture research report). The structure and liquidity
 * PRIMITIVES (swing highs/lows, BOS/CHOCH, liquidity sweeps) are reproduced
 * faithfully from the upstream source at the commit hash recorded here. The
 * ENTRY/INVALIDATION/TARGET assembly on top of those primitives is our own
 * — smc.py ships no strategy logic at all, only structure/liquidity
 * detection — and is documented separately below, not attributed upstream.
 */
export const SYSTEM_C_ID = 'SYSTEM_C' as const;
export const SYSTEM_C_MODEL_NAME = 'Market Structure + Liquidity (SMC)' as const;
export const SYSTEM_C_SCHOOL = 'liquidity' as const;

export const SYSTEM_C_PROVENANCE = {
  systemId: SYSTEM_C_ID,
  displayName: SYSTEM_C_MODEL_NAME,
  primitivesVersion: 'joshyattridge/smart-money-concepts @ 1b62fd6 (v0.0.27)',
  sourceRepository: 'https://github.com/joshyattridge/smart-money-concepts',
  sourceCommit: '1b62fd6c41e1f508e7ed76831a039fa4c82d42f6',
  sourceFile: 'smartmoneyconcepts/smc.py',
  sourceFunctionsPorted: ['swing_highs_lows', 'bos_choch', 'liquidity'],
  sourceFunctionsDeliberatelyExcluded: [
    'ob() (Order Blocks) — flagged in the research report as an optional secondary confirmation layer, not part of the primary reasoning chain for this baseline.',
    'fvg() (Fair Value Gaps) — same reason as ob().',
    'sessions() (forex kill-zone logic) — explicitly rejected: no equivalent institutional session boundary exists in a 24/7 Binance futures market.',
    'previous_high_low(), retracements() — not needed by the entry/invalidation/target assembly chosen for this baseline.',
  ],
  licence: 'MIT',
  licenceUrl: 'https://github.com/joshyattridge/smart-money-concepts/blob/master/LICENSE',
  importedAt: '2026-07-17',
  reimplementationApproach:
    'Clean-room reimplementation in original TypeScript from the documented behaviour of swing_highs_lows/bos_choch/liquidity (docstrings + read-through of the source logic), not a line-by-line port of the numpy/pandas implementation.',
  upstreamEndorsementDisclaimer:
    'This is an independent reimplementation for research/comparison purposes. The upstream author has not reviewed or endorsed this project, and did not write any entry/exit/stop/target logic — smc.py is a structure/liquidity detection library only.',
  ownAssemblyDisclaimer:
    'The liquidity-sweep-then-structural-reclaim entry model, stop placement (beyond the swept extreme), and target derivation (opposing un-swept liquidity, or next structural swing as fallback) implemented in signals/liquiditySweepReversal.ts are THIS PROJECT\'S assembly of the upstream primitives, following the standard, widely-documented SMC/ICT community usage pattern — not something copied or endorsed by joshyattridge/smart-money-concepts.',
} as const;
