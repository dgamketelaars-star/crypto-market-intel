import type { Candle } from '../../services/binance/types';
import { INTEL_RULES } from '../rules';

export interface VolumeProfileBucket {
  priceLow: number;
  priceHigh: number;
  volume: number;
  /** How many distinct candles contributed volume to this bucket — a single isolated print is not the same evidence as repeated trading interest. */
  touches: number;
}

export interface VolumeProfileResult {
  buckets: VolumeProfileBucket[];
  /** Price of the single highest-volume bucket — the window's "fair value" anchor. */
  poc: number;
  /** The ~70%-of-volume range around POC — prices outside it were comparatively rejected by the market. */
  valueAreaHigh: number;
  valueAreaLow: number;
  /** Local volume peaks — well-agreed-upon prices, candidate structural levels. */
  highVolumeNodes: number[];
  /** Local volume troughs ("gaps") — prices the market moved through quickly, candidate fast-travel paths. */
  lowVolumeNodes: number[];
  sufficientData: boolean;
}

const EMPTY_RESULT: VolumeProfileResult = { buckets: [], poc: 0, valueAreaHigh: 0, valueAreaLow: 0, highVolumeNodes: [], lowVolumeNodes: [], sufficientData: false };

function bucketMidpoint(bucket: VolumeProfileBucket): number {
  return (bucket.priceLow + bucket.priceHigh) / 2;
}

/**
 * Builds a volume profile from OHLCV candles alone — no tick/trade data
 * required. Each candle's volume is distributed proportionally across every
 * price bucket its [low, high] range overlaps (the same approximation
 * TradingView's built-in "Volume Profile" indicator uses when only bar data
 * is available). This is deliberately a *second, independent* source of
 * structural levels alongside the existing swing-pivot support/resistance
 * zones — POC/Value-Area/HVN describe where volume actually concentrated,
 * which price-swing extremes alone cannot show.
 */
export function buildVolumeProfile(candles: Candle[], bucketCount = 50): VolumeProfileResult {
  if (candles.length === 0) return EMPTY_RESULT;

  const rangeLow = Math.min(...candles.map((c) => c.low));
  const rangeHigh = Math.max(...candles.map((c) => c.high));
  if (rangeHigh <= rangeLow) return EMPTY_RESULT;

  const bucketWidth = (rangeHigh - rangeLow) / bucketCount;
  const buckets: VolumeProfileBucket[] = Array.from({ length: bucketCount }, (_, i) => ({
    priceLow: rangeLow + i * bucketWidth,
    priceHigh: rangeLow + (i + 1) * bucketWidth,
    volume: 0,
    touches: 0,
  }));

  for (const candle of candles) {
    const candleRange = candle.high - candle.low;
    if (candleRange <= 0) {
      const index = Math.min(bucketCount - 1, Math.max(0, Math.floor((candle.close - rangeLow) / bucketWidth)));
      buckets[index].volume += candle.volume;
      buckets[index].touches += 1;
      continue;
    }
    for (const bucket of buckets) {
      const overlap = Math.min(candle.high, bucket.priceHigh) - Math.max(candle.low, bucket.priceLow);
      if (overlap > 0) {
        bucket.volume += candle.volume * (overlap / candleRange);
        bucket.touches += 1;
      }
    }
  }

  const totalVolume = buckets.reduce((sum, b) => sum + b.volume, 0);
  if (totalVolume <= 0) return EMPTY_RESULT;

  const pocIndex = buckets.reduce((best, b, i) => (b.volume > buckets[best].volume ? i : best), 0);
  const poc = bucketMidpoint(buckets[pocIndex]);

  // Value area: expand outward from POC, each step adding whichever unincluded neighbor (above or below) carries more volume.
  let lowIndex = pocIndex;
  let highIndex = pocIndex;
  let accumulated = buckets[pocIndex].volume;
  const target = totalVolume * 0.7;
  while (accumulated < target && (lowIndex > 0 || highIndex < buckets.length - 1)) {
    const belowVolume = lowIndex > 0 ? buckets[lowIndex - 1].volume : -1;
    const aboveVolume = highIndex < buckets.length - 1 ? buckets[highIndex + 1].volume : -1;
    if (aboveVolume >= belowVolume) {
      highIndex += 1;
      accumulated += buckets[highIndex].volume;
    } else {
      lowIndex -= 1;
      accumulated += buckets[lowIndex].volume;
    }
  }

  const meanVolume = totalVolume / bucketCount;
  const highVolumeNodes: number[] = [];
  const lowVolumeNodes: number[] = [];
  for (let i = 0; i < buckets.length; i++) {
    const prev = buckets[i - 1]?.volume ?? -Infinity;
    const next = buckets[i + 1]?.volume ?? -Infinity;
    const current = buckets[i].volume;
    if (current > prev && current > next && current >= meanVolume * INTEL_RULES.volumeProfile.hvnMeanMult && buckets[i].touches >= 2) {
      highVolumeNodes.push(bucketMidpoint(buckets[i]));
    } else if (
      // Non-strict on both sides: a true gap is commonly a multi-bucket run of exactly zero volume, not a single-bucket dip.
      current <= prev &&
      current <= next &&
      current <= meanVolume * INTEL_RULES.volumeProfile.lvnMeanMult
    ) {
      lowVolumeNodes.push(bucketMidpoint(buckets[i]));
    }
  }

  return {
    buckets,
    poc,
    valueAreaHigh: buckets[highIndex].priceHigh,
    valueAreaLow: buckets[lowIndex].priceLow,
    highVolumeNodes,
    lowVolumeNodes,
    sufficientData: true,
  };
}
