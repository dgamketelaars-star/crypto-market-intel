/**
 * Known limitations of the upstream FSupertrendStrategy parameters, surfaced
 * explicitly per the research report's "do not silently fix, document
 * instead" rule. None of these are corrected in this reimplementation.
 */
export const SYSTEM_B_LIMITATIONS: readonly string[] = [
  'Fixed stoploss is -26.5%, identical across every strategy in the upstream futures/ folder (FOttStrategy, TrendFollowingStrategy). This strongly suggests a shared placeholder value rather than a Supertrend-specific tuned stop, not a validated risk parameter for this indicator.',
  'The ROI table ({0: 10%, 30: 75%, 60: 5%, 120: 2.5%}) is non-monotonic: the required ROI briefly jumps to 75% between minute 30 and 60 before dropping back to 5%. This is almost certainly an upstream typo (likely meant 7.5%, i.e. 0.075), but it is reproduced exactly as written — a setup will show its real, honest ROI target at each stage, including the 75% spike, rather than a silently "corrected" value.',
  'Hyperopt parameters (buy_m1/buy_p1/etc.) were derived by the upstream author on a 1h timerange starting 2021-01-01 with no disclosed out-of-sample or walk-forward validation. Reproduced as-is; not re-tuned for the Top-20 Binance Futures universe.',
  'The upstream docstring itself states the Supertrend implementation "is not validated; meaning this is not proven to match results by the paper where it was originally introduced or any other trusted academic resources."',
];
