/**
 * Code Provenance record for System D (Ichimoku Cloud). See the research
 * report delivered before implementation for the full repository review.
 *
 * Repositories researched:
 *  - TA-Lib/ta-lib-python (BSD-2-Clause, 12k+ stars) — the best-known TA
 *    library wrapper, but TA-Lib's underlying C library has never shipped an
 *    Ichimoku function at all. Rejected: not a candidate, confirms this is a
 *    genuinely under-served indicator in the most "canonical" TA library.
 *  - anandanand84/technicalindicators (MIT, ~2.4k stars, TypeScript) — the
 *    most popular JS/TS technical-indicators package, with a dedicated
 *    src/ichimoku/IchimokuCloud.ts. Rejected as the reference: reading the
 *    source shows its `displacement` input is accepted but never applied —
 *    the forward-shift logic for Senkou Span A/B is present only as
 *    commented-out dead code — and it has no Chikou Span at all.
 *  - bukosabino/ta (MIT, ~5.1k stars, Python, actively maintained) — a
 *    widely used, professionally-referenced TA library. Its
 *    IchimokuIndicator correctly computes Tenkan-sen, Kijun-sen, Senkou
 *    Span A and B, with a `visual` flag that correctly toggles the
 *    26-period forward displacement. Strong candidate, but ships no Chikou
 *    Span function at all (4 of 5 classic Ichimoku lines).
 *  - xgboosted/pandas-ta-classic (MIT, ~400 stars, Python, actively
 *    maintained community continuation of the now-deleted twopirllc/pandas-
 *    ta) — CHOSEN REFERENCE. Its `ichimoku()` function is the only one
 *    reviewed that correctly implements all five classic components
 *    (Tenkan-sen, Kijun-sen, Senkou Span A, Senkou Span B, Chikou Span),
 *    correctly displaces Senkou A/B forward and Chikou Span backward by the
 *    Kijun period, and additionally returns a second "future cloud"
 *    DataFrame projecting Span A/B beyond the last close — matching how
 *    professional charting platforms (TradingView, StockCharts) actually
 *    display the indicator.
 *
 * Why pandas-ta-classic was chosen: it is the only reviewed implementation
 * complete across all five lines, its displacement handling for both the
 * cloud (forward) and Chikou (backward) is textbook-correct, and it is
 * actively maintained (MIT). The freqtrade-strategies "lookahead_bias"
 * folder was also reviewed for a real-world Ichimoku cautionary example
 * (Zeus.py): its bug was NOT in Ichimoku's own math (it used `ta`'s
 * correctly-implemented ichimoku_base_line) but in a downstream min-max
 * normalisation using the whole dataframe's future values — a reminder that
 * followed here by never normalising any System D value against anything
 * but strictly past data.
 */
export const SYSTEM_D_ID = 'SYSTEM_D' as const;
export const SYSTEM_D_MODEL_NAME = 'Ichimoku Kinko Hyo' as const;
export const SYSTEM_D_SCHOOL = 'ichimoku' as const;

export const SYSTEM_D_PROVENANCE = {
  systemId: SYSTEM_D_ID,
  displayName: SYSTEM_D_MODEL_NAME,
  sourceRepository: 'https://github.com/xgboosted/pandas-ta-classic',
  sourceFile: 'pandas_ta_classic/overlap/ichimoku.py',
  sourceFunctionPorted: 'ichimoku()',
  referenceDescription:
    'Reference for correct Tenkan-sen/Kijun-sen/Senkou Span A/B/Chikou Span formulas and displacement handling only. No entry, stop, target, or signal-strength logic exists in the upstream source — pandas-ta-classic is an indicator-calculation library, not a strategy.',
  licence: 'MIT',
  licenceUrl: 'https://github.com/xgboosted/pandas-ta-classic/blob/main/LICENSE',
  importedAt: '2026-07-17',
  reimplementationApproach:
    'Clean-room reimplementation in original TypeScript from the documented formulas (docstring + read-through), not a line-by-line port of the pandas implementation. The Chikou Span is deliberately reformulated for live evaluation — see indicators/ichimoku.ts for why the literal shift(-kijun) definition cannot be used at the current bar.',
  designNotesAdoptedFromResearch: [
    'All five classic lines (Tenkan, Kijun, Senkou A, Senkou B, Chikou) — pandas-ta-classic was the only reference with all five correct.',
    'Forward displacement of the cloud by the Kijun period, and a separately-tracked "future cloud" (undisplaced spans computed from the latest bar) — matches how professional Ichimoku charting displays the indicator.',
    'Standard community-consensus periods: Tenkan 9 / Kijun 26 / Senkou 52, unchanged from Hosoda\'s original defaults — no re-tuning.',
  ],
  ownAssemblyDisclaimer:
    'The trend/bias reading, TK-cross detection, Kumo-breakout detection, Kijun-bounce detection, Chikou-confirmation check, and strong/moderate signal grading in signals/ichimokuSignal.ts are THIS PROJECT\'S assembly, following the widely-documented community-consensus way experienced Ichimoku traders combine these components (price vs. cloud, cloud colour, cloud thickness, TK cross location, Chikou clearance) — not something present in or endorsed by pandas-ta-classic, which ships no trading logic at all.',
  upstreamEndorsementDisclaimer:
    'This is an independent reimplementation for research/comparison purposes. The upstream authors have not reviewed or endorsed this project.',
} as const;
