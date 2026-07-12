import type { SetupFamily, SetupStatus, TradeHorizon } from '../engine/types';

export const tradeHorizonLabels: Record<TradeHorizon, string> = {
  DAY_TRADE: 'Day trade',
  SWING_TRADE: 'Swing trade',
};

export const familyLabels: Record<SetupFamily, string> = {
  trend_continuation_breakout: 'Trend continuation breakout',
  trend_continuation_pullback: 'Trend continuation pullback',
  range_breakout: 'Range breakout',
  failed_breakout_reversal: 'Failed breakout / reversal',
  momentum_divergence_reversal: 'Momentum divergence reversal',
  volatility_compression_breakout: 'Volatility compression breakout',
  evidence_based_thesis: 'Evidence-based thesis',
};

export const statusLabels: Record<SetupStatus, string> = {
  candidate: 'Candidate',
  waiting_for_confirmation: 'Waiting for confirmation',
  active: 'Active',
  invalidated: 'Invalidated',
  completed: 'Completed',
  expired: 'Expired',
};
