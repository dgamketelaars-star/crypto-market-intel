/**
 * Code Provenance record for System B (see the Open-Source Crypto Setup
 * Comparator research report). This is a reimplementation, not a port: no
 * source file from the upstream repository was copied into this project.
 * The entry/exit/stop/target RULES below are reproduced faithfully from the
 * upstream source read at the commit hash recorded here; the TypeScript
 * expressing those rules is original.
 */
export const SYSTEM_B_ID = 'OPEN_SOURCE_BASELINE_V1' as const;

export const SYSTEM_B_PROVENANCE = {
  systemId: SYSTEM_B_ID,
  displayName: 'FSupertrendStrategy',
  strategyVersion: 'freqtrade/freqtrade-strategies @ b8a90be',
  sourceRepository: 'https://github.com/freqtrade/freqtrade-strategies',
  sourceCommit: 'b8a90bebebfc13a78416635166ebafdece596d3f',
  repoHeadCommitAtImport: 'dbd5b0b21cfbf5ee80588d37458ace2467b7f8a4',
  sourceFile: 'user_data/strategies/futures/FSupertrendStrategy.py',
  sourceAuthor: '@juankysoriano (Juan Carlos Soriano)',
  licence: 'GPL-3.0',
  licenceUrl: 'https://github.com/freqtrade/freqtrade-strategies/blob/main/LICENSE',
  importedAt: '2026-07-17',
  reimplementationApproach:
    'Clean-room reimplementation in original TypeScript from the documented indicator formulas and entry/exit/stop/ROI/trailing rules. No Python source was copied or translated line-by-line — this avoids GPL-3.0 copyleft attaching to this (currently unlicensed) project while still faithfully reproducing the upstream logic.',
  upstreamEndorsementDisclaimer:
    'This is an independent reimplementation for research/comparison purposes. The upstream author has not reviewed or endorsed this project.',
  modificationsFromUpstream: [
    'None to the decision rules themselves (entries, exits, stop, ROI table, trailing stop are reproduced as originally written).',
    'The 3 independent Supertrend confirmations are computed once per pair of (multiplier, period) rather than via the upstream hyperopt-parameter-sweep machinery — we use only the single "winning" hyperopt values baked into the upstream file (buy_params / sell_params), not the full IntParameter search ranges (those ranges only matter during freqtrade hyperopt runs, which this project does not reproduce).',
  ],
  behaviouralDifferencesFromUpstream: [
    'Freqtrade backtests on completed candles with its own internal ROI/trailing-stop simulation engine, which evaluates intra-candle price paths using configurable fill assumptions. We only observe candle-close and live ticker prices, so intra-candle ROI/trailing triggers are approximated using close-to-close and last-price checks rather than replaying intra-candle wicks. See the Limitations section in strategyLimitations.ts.',
    'trailing_only_offset_is_reached is False upstream, which (per freqtrade docs) means the 5% trailing distance (trailing_stop_positive) becomes active as soon as ANY profit exists, not gated behind the 10% offset (trailing_stop_positive_offset). We reproduce this reading; it is the most defensible interpretation of the documented freqtrade semantics but was not verified against a real freqtrade backtest run.',
  ],
} as const;
