import type {
  AttentionLevel,
  FundingState,
  MomentumClassification,
  OpenInterestTrend,
  StructureSignal,
  TrendClassification,
  VolatilityClassification,
  VolumeClassification,
} from '../engine/types';

export const trendLabels: Record<TrendClassification, string> = {
  uptrend: 'Uptrend',
  downtrend: 'Downtrend',
  sideways: 'Sideways',
  transition: 'Transition',
  insufficient_data: 'Onvoldoende data',
};

export const momentumLabels: Record<MomentumClassification, string> = {
  strengthening: 'Sterker wordend',
  weakening: 'Verzwakkend',
  neutral: 'Neutraal',
  diverging: 'Divergerend',
  insufficient_data: 'Onvoldoende data',
};

export const volatilityLabels: Record<VolatilityClassification, string> = {
  low: 'Laag',
  normal: 'Normaal',
  elevated: 'Verhoogd',
  extreme: 'Extreem',
  insufficient_data: 'Onvoldoende data',
};

export const volumeLabels: Record<VolumeClassification, string> = {
  low: 'Laag',
  normal: 'Normaal',
  elevated: 'Verhoogd',
  spike: 'Spike',
  insufficient_data: 'Onvoldoende data',
};

export const structureLabels: Record<StructureSignal, string> = {
  breakout_candidate: 'Mogelijke breakout',
  breakdown_candidate: 'Mogelijke breakdown',
  failed_breakout: 'Mislukte breakout',
  range_compression: 'Compressie',
  expansion_after_compression: 'Expansie na compressie',
  none: 'Geen patroon',
  insufficient_data: 'Onvoldoende data',
};

export const fundingStateLabels: Record<FundingState, string> = {
  very_low: 'Zeer laag',
  low: 'Laag',
  neutral: 'Neutraal',
  elevated: 'Verhoogd',
  very_elevated: 'Zeer verhoogd',
  insufficient_data: 'Onvoldoende data',
};

export const oiTrendLabels: Record<OpenInterestTrend, string> = {
  rising: 'Stijgend',
  falling: 'Dalend',
  flat: 'Vlak',
  insufficient_data: 'Onvoldoende data',
};

export const attentionLabels: Record<AttentionLevel, string> = {
  normal: 'Normal',
  worth_watching: 'Worth watching',
  unusual_activity: 'Unusual activity',
  insufficient_data: 'Insufficient data',
};
