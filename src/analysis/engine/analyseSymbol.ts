import type { Candle, CandleInterval, FundingData, MarkPriceData, OpenInterestData, TickerData } from '../../services/binance/types';
import { CANDLE_INTERVALS } from '../../store/marketDataStore';
import { formatUsdPrice } from '../../utils/format';
import { calculateAverage, calculateRelativeVolume } from '../indicators/volume';
import { analysePositioning } from '../derivatives/positioning';
import type { FundingSample, OiSample } from './historyBuffer';
import { buildFreshness } from './freshness';
import { classifyAttentionLevel, classifyVolume, type AttentionDeviation } from './rules';
import { analyseTimeframe } from './timeframeAnalysis';
import { buildAttentionExplanation } from '../explanations/featureExplanations';
import type {
  AttentionFeature,
  MarketStructureAnalysis,
  MomentumAnalysis,
  PositioningAnalysis,
  SymbolAnalysis,
  TimeframeAnalysis,
  VolatilityAnalysis,
  VolumeAnalysis,
} from './types';

const PRIMARY_TIMEFRAME: CandleInterval = '1h';

export interface AnalyseSymbolInput {
  symbol: string;
  candles: Partial<Record<CandleInterval, Candle[]>>;
  ticker?: TickerData;
  markPrice?: MarkPriceData;
  funding?: FundingData;
  openInterest?: OpenInterestData;
  quoteVolumeRank: number | null;
  universeSize: number | null;
  oiHistory: OiSample[];
  fundingHistory: FundingSample[];
  calculatedAt?: number;
}

function analyseVolume(
  primaryCandles: Candle[],
  quoteVolumeRank: number | null,
  universeSize: number | null,
  calculatedAt: number,
): VolumeAnalysis {
  const dataTimestamp = primaryCandles.length ? primaryCandles[primaryCandles.length - 1].closeTime : 0;
  const volumes = primaryCandles.map((c) => c.volume);
  const currentVolume = volumes.length ? volumes[volumes.length - 1] : null;
  const averageVolume20 = calculateAverage(volumes.slice(0, -1), 20);
  const relativeVolume = currentVolume !== null ? calculateRelativeVolume(currentVolume, averageVolume20) : null;
  const classification = classifyVolume(relativeVolume);

  return {
    timeframe: PRIMARY_TIMEFRAME,
    classification,
    currentVolume,
    averageVolume20,
    relativeVolume,
    quoteVolumeRank,
    universeSize,
    isSpike: classification === 'spike',
    freshness: buildFreshness(dataTimestamp, calculatedAt),
    sufficientData: relativeVolume !== null,
  };
}

interface FeatureCheck {
  group: string;
  missing: boolean;
  deviates: boolean;
  conflict: boolean;
  label: string;
  detail: string;
}

function checkMomentum(momentum: MomentumAnalysis | undefined): FeatureCheck {
  if (!momentum || !momentum.sufficientData) {
    return {
      group: 'momentum',
      missing: true,
      deviates: false,
      conflict: false,
      label: 'Momentum',
      detail: 'Onvoldoende candles voor een betrouwbare momentum-lezing (1h).',
    };
  }
  if (momentum.classification === 'diverging') {
    return {
      group: 'momentum',
      missing: false,
      deviates: true,
      conflict: true,
      label: 'Divergerend momentum',
      detail: 'Prijs en RSI bewegen niet dezelfde kant op (1h) — de beweging oogt minder overtuigend dan de prijs suggereert.',
    };
  }
  if (momentum.classification === 'strengthening') {
    return {
      group: 'momentum',
      missing: false,
      deviates: true,
      conflict: false,
      label: 'Momentum versterkt',
      detail: 'RSI en MACD-histogram bevestigen elkaar en nemen toe (1h).',
    };
  }
  return {
    group: 'momentum',
    missing: false,
    deviates: false,
    conflict: false,
    label: 'Momentum',
    detail: `Momentum is ${momentum.classification} op 1h.`,
  };
}

function checkVolatility(volatility: VolatilityAnalysis | undefined): FeatureCheck {
  if (!volatility || !volatility.sufficientData) {
    return {
      group: 'volatility',
      missing: true,
      deviates: false,
      conflict: false,
      label: 'Volatility',
      detail: 'Onvoldoende candles voor een ATR-baseline (1h).',
    };
  }
  if (volatility.classification === 'extreme' || volatility.classification === 'elevated') {
    return {
      group: 'volatility',
      missing: false,
      deviates: true,
      conflict: false,
      label: volatility.classification === 'extreme' ? 'Extreme volatility' : 'Verhoogde volatility',
      detail: `ATR ligt op ${volatility.atrPct?.toFixed(2)}% van de prijs, ${
        volatility.classification === 'extreme' ? 'ruim boven' : 'boven'
      } het recente gemiddelde (1h).`,
    };
  }
  return {
    group: 'volatility',
    missing: false,
    deviates: false,
    conflict: false,
    label: 'Volatility',
    detail: `Volatility is ${volatility.classification} op 1h.`,
  };
}

function checkVolume(volume: VolumeAnalysis): FeatureCheck {
  if (!volume.sufficientData) {
    return {
      group: 'volume',
      missing: true,
      deviates: false,
      conflict: false,
      label: 'Volume',
      detail: 'Onvoldoende candles voor een volumegemiddelde (1h).',
    };
  }
  if (volume.classification === 'spike' || volume.classification === 'elevated') {
    return {
      group: 'volume',
      missing: false,
      deviates: true,
      conflict: false,
      label: volume.classification === 'spike' ? 'Volume-spike' : 'Verhoogd volume',
      detail: `Volume ligt op ${volume.relativeVolume?.toFixed(1)}x het 20-candle gemiddelde (1h).`,
    };
  }
  return {
    group: 'volume',
    missing: false,
    deviates: false,
    conflict: false,
    label: 'Volume',
    detail: `Volume is ${volume.classification} op 1h.`,
  };
}

function checkPositioning(positioning: PositioningAnalysis): FeatureCheck {
  if (!positioning.sufficientData) {
    return {
      group: 'positioning',
      missing: true,
      deviates: false,
      conflict: false,
      label: 'Futures positioning',
      detail: 'Nog geen funding- of Open Interest-data binnen.',
    };
  }

  const notes: string[] = [];
  let deviates = false;
  let conflict = false;

  if (positioning.oiTrend === 'rising' || positioning.oiTrend === 'falling') {
    deviates = true;
    notes.push(
      `Open Interest ${positioning.oiTrend === 'rising' ? 'stijgt' : 'daalt'} ${positioning.oiChange4hPct?.toFixed(1)}% (4h)`,
    );
  }
  if (['elevated', 'very_elevated', 'low', 'very_low'].includes(positioning.fundingState)) {
    deviates = true;
    notes.push(`funding is ${positioning.fundingState.replace('_', ' ')} t.o.v. recente waarnemingen`);
  }
  if (positioning.priceOiDivergence) {
    deviates = true;
    conflict = true;
    notes.push('prijs en Open Interest bewegen niet dezelfde kant op (24h)');
  }

  if (!deviates) {
    return {
      group: 'positioning',
      missing: false,
      deviates: false,
      conflict: false,
      label: 'Futures positioning',
      detail: 'Funding en Open Interest tonen geen bijzonder patroon.',
    };
  }

  return {
    group: 'positioning',
    missing: false,
    deviates: true,
    conflict,
    label: conflict ? 'Prijs en Open Interest wijken af' : 'Positionering verschuift',
    detail: `${notes.join('; ')}.`.replace(/^./, (c) => c.toUpperCase()),
  };
}

function checkStructure(structure: MarketStructureAnalysis | undefined): FeatureCheck {
  if (!structure || !structure.sufficientData) {
    return {
      group: 'structure',
      missing: true,
      deviates: false,
      conflict: false,
      label: 'Marktstructuur',
      detail: 'Onvoldoende candles om steun/weerstand te bepalen (1h).',
    };
  }

  const deviates = (
    ['breakout_candidate', 'breakdown_candidate', 'failed_breakout', 'expansion_after_compression'] as const
  ).includes(structure.signal as never);
  const conflict = structure.signal === 'failed_breakout';

  const labels: Record<string, string> = {
    breakout_candidate: 'Mogelijke breakout',
    breakdown_candidate: 'Mogelijke breakdown',
    failed_breakout: 'Mislukte breakout',
    expansion_after_compression: 'Expansie na compressie',
  };

  if (deviates) {
    return {
      group: 'structure',
      missing: false,
      deviates: true,
      conflict,
      label: labels[structure.signal] ?? 'Structuurpatroon',
      detail: describeStructure(structure),
    };
  }

  return {
    group: 'structure',
    missing: false,
    deviates: false,
    conflict: false,
    label: 'Marktstructuur',
    detail:
      structure.signal === 'range_compression'
        ? 'Range compressie zichtbaar (1h), nog geen uitbraak.'
        : 'Geen bijzonder structuurpatroon op 1h.',
  };
}

function describeStructure(structure: MarketStructureAnalysis): string {
  if (structure.signal === 'breakout_candidate' && structure.nearestResistance) {
    return `Prijs sloot boven de weerstand rond ${formatUsdPrice(structure.nearestResistance.price)} (1h).`;
  }
  if (structure.signal === 'breakdown_candidate' && structure.nearestSupport) {
    return `Prijs sloot onder de support rond ${formatUsdPrice(structure.nearestSupport.price)} (1h).`;
  }
  if (structure.signal === 'failed_breakout' && structure.nearestResistance) {
    return `Prijs brak door de weerstand rond ${formatUsdPrice(structure.nearestResistance.price)} maar zakte er weer onder (1h).`;
  }
  if (structure.signal === 'expansion_after_compression') {
    return 'De range trok eerst samen en breidt nu weer uit (1h).';
  }
  return 'Opvallend structuurpatroon op 1h.';
}

export function analyseSymbol(input: AnalyseSymbolInput): SymbolAnalysis {
  const calculatedAt = input.calculatedAt ?? Date.now();

  const timeframes: Partial<Record<CandleInterval, TimeframeAnalysis>> = {};
  let latestDataTimestamp = 0;
  for (const interval of CANDLE_INTERVALS) {
    const candles = input.candles[interval];
    if (candles && candles.length > 0) {
      const tf = analyseTimeframe(candles, interval, calculatedAt);
      timeframes[interval] = tf;
      latestDataTimestamp = Math.max(latestDataTimestamp, tf.trend.freshness.dataTimestamp);
    }
  }

  const primaryCandles = input.candles[PRIMARY_TIMEFRAME] ?? [];
  const volume = analyseVolume(primaryCandles, input.quoteVolumeRank, input.universeSize, calculatedAt);

  const positioning = analysePositioning({
    fundingRate: input.funding?.fundingRate ?? null,
    fundingTime: input.funding?.time ?? null,
    openInterest: input.openInterest?.openInterest ?? null,
    openInterestTime: input.openInterest?.time ?? null,
    priceChange24hPct: input.ticker?.priceChangePercent ?? null,
    oiHistory: input.oiHistory,
    fundingHistory: input.fundingHistory,
    calculatedAt,
  });
  latestDataTimestamp = Math.max(latestDataTimestamp, positioning.freshness.dataTimestamp, volume.freshness.dataTimestamp);

  const primary = timeframes[PRIMARY_TIMEFRAME];
  const checks = [
    checkMomentum(primary?.momentum),
    checkVolatility(primary?.volatility),
    checkVolume(volume),
    checkPositioning(positioning),
    checkStructure(primary?.structure),
  ];

  const deviations: AttentionDeviation[] = checks.map((c) => ({ group: c.group, deviates: c.deviates, reason: c.detail }));
  const missingCount = checks.filter((c) => c.missing).length;
  const hasSufficientCoreData = missingCount < 3;
  const attention = classifyAttentionLevel(deviations, hasSufficientCoreData);

  const toFeature = (c: FeatureCheck): AttentionFeature => ({ key: c.group, label: c.label, detail: c.detail });
  const supporting = checks.filter((c) => c.deviates && !c.conflict).map(toFeature);
  const conflicting = checks.filter((c) => c.deviates && c.conflict).map(toFeature);
  const neutral = checks.filter((c) => !c.deviates && !c.missing).map(toFeature);
  const missingData = checks.filter((c) => c.missing).map(toFeature);

  const explanation = buildAttentionExplanation(input.symbol, attention, supporting, neutral, conflicting, missingData);

  return {
    symbol: input.symbol,
    timeframes,
    volume,
    positioning,
    attention,
    explanation,
    calculatedAt,
    dataTimestamp: latestDataTimestamp,
  };
}
