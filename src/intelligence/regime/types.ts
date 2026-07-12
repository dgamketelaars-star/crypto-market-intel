export const MARKET_REGIMES = [
  'strong_uptrend',
  'weak_uptrend',
  'strong_downtrend',
  'weak_downtrend',
  'range',
  'compression',
  'expansion',
  'transition',
  'chaotic',
  'insufficient_data',
] as const;

/** The 9 meaningful regime states, plus the shared 'insufficient_data' fallback used across this codebase's other classifications. */
export type MarketRegime = (typeof MARKET_REGIMES)[number];

export interface MarketRegimeResult {
  regime: MarketRegime;
  bias: 'bullish' | 'bearish' | 'neutral';
  /** Human-readable reasoning trail — every classification is traceable back to the inputs that produced it. */
  reasoning: string[];
}
