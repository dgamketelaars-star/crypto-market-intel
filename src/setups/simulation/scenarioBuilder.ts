import type { Candle } from '../../services/binance/types';
import { makeCandle } from '../../analysis/testUtils/fixtures';
import { analyseSymbol } from '../../analysis/engine/analyseSymbol';
import { aggregateCandles } from './simulationEngine';

export type ScenarioOutcome = 'continue' | 'reverse' | 'stall';

export interface TrendBreakoutScenarioOptions {
  basePrice?: number;
  uptrendCandles?: number;
  uptrendStep?: number;
  consolidationCandles?: number;
  outcome?: ScenarioOutcome;
  breakoutVolumeMultiplier?: number;
}

/**
 * Builds a synthetic 1H candle sequence: a long warm-up (so EMA200 has
 * enough history), a steady uptrend, a consolidation just under a
 * resistance level, and then one of three outcomes — a confirmed breakout
 * that runs to target, a breakout that fails and reverses through
 * invalidation, or an indefinite stall that never confirms (for expiry).
 */
export function buildTrendBreakoutCandles(opts: TrendBreakoutScenarioOptions = {}): Candle[] {
  const {
    basePrice = 100,
    uptrendCandles = 40,
    uptrendStep = 1.0,
    consolidationCandles = 8,
    outcome = 'continue',
    breakoutVolumeMultiplier = 4,
  } = opts;

  const candles: Candle[] = [];
  let index = 0;
  const hourMs = 3_600_000;

  const push = (close: number, volume: number) => {
    const high = close + Math.abs(close) * 0.002;
    const low = close - Math.abs(close) * 0.002;
    candles.push(
      makeCandle(
        { close, volume, high, low, openTime: index * hourMs, closeTime: index * hourMs + hourMs - 1 },
        index,
      ),
    );
    index += 1;
  };

  // Warm-up: enough flat history for EMA200 to be defined before the story starts.
  for (let i = 0; i < 210; i++) push(basePrice - 15 + i * 0.01, 100);

  // Uptrend into a resistance level — a small oscillation avoids the RSI/MACD
  // artifacts a perfectly straight line produces, keeping momentum readings realistic.
  let price = basePrice;
  for (let i = 0; i < uptrendCandles; i++) {
    price += uptrendStep + Math.sin(i / 3) * (uptrendStep * 0.3);
    push(price, 100);
  }

  // Strictly monotonic (gently declining) consolidation — an alternating or
  // flat/tied price creates spurious interior swing-point pivots that confuse
  // the zone detector. A strict monotonic ramp has no interior extremum, so
  // the uptrend peak right before it stays the one dominant resistance pivot.
  const resistance = price + 1;
  const consolidationLevel = resistance - 0.5;
  for (let i = 0; i < consolidationCandles; i++) {
    push(consolidationLevel - i * 0.01, 85);
  }

  if (outcome === 'continue') {
    // Ask the *real* analysis engine what zone it actually detected from the
    // candles built so far, instead of guessing an offset from the nominal
    // `resistance` reference by trial and error — resolveZone's swing-pivot
    // selection doesn't land exactly on that nominal value, and hand-tuning
    // a fixed offset against it has proven fragile across rule changes.
    // Anchoring to the real detected zone keeps this scenario correct
    // regardless of how the analysis engine's pivot selection evolves.
    const soFar = candles.slice();
    const lastClose = soFar[soFar.length - 1].close;
    const probeAnalysis = analyseSymbol({
      symbol: 'SIMUSDT',
      candles: { '1h': soFar, '4h': aggregateCandles(soFar, 4), '1d': aggregateCandles(soFar, 24) },
      ticker: { symbol: 'SIMUSDT', lastPrice: lastClose, priceChangePercent: 0, quoteVolume: lastClose * 100, time: 0 },
      funding: undefined,
      openInterest: undefined,
      quoteVolumeRank: 1,
      universeSize: 20,
      oiHistory: [],
      fundingHistory: [],
      calculatedAt: 0,
    });
    const realZone = probeAnalysis.timeframes['1h']?.structure.nearestResistance?.price ?? resistance;

    // A minimal overshoot — just enough to clear the family's own 0.15%
    // structural-break buffer, no more. Since ATR here is itself only
    // ~0.5-0.6% of price, any overshoot meaningfully larger than the break
    // buffer eats a large chunk of the reward:risk budget before the
    // breakout candle is even confirmed.
    const breakoutBase = realZone * 1.0017;
    push(breakoutBase, 100 * breakoutVolumeMultiplier);
    // Realistic, gradual continuation — strictly monotonic (never flat or
    // tied) so it never creates a spurious interior swing pivot that would
    // redefine the resistance zone mid-scenario (see the consolidation
    // comment above). Deliberately slow for the first stretch so entry
    // doesn't outrun the (still zone-anchored) invalidation level before
    // confirmation completes — a fast ramp during that debounce window
    // fails the minimum reward:risk gate right as it would otherwise
    // activate. Volume stays elevated for the same stretch, then tapers off
    // as real breakout follow-through does.
    for (let i = 0; i < 60; i++) push(breakoutBase + (i + 1) * (realZone * 0.00001), 220);
    for (let i = 0; i < 40; i++) push(breakoutBase + (i + 1) * 0.08, 130);
  } else if (outcome === 'reverse') {
    push(resistance + 0.8, 100 * breakoutVolumeMultiplier);
    for (let i = 0; i < 8; i++) push(resistance - 6 - i * 3, 160);
  } else {
    let level = consolidationLevel - consolidationCandles * 0.01;
    for (let i = 0; i < 60; i++) {
      level -= 0.003;
      push(level, 80);
    }
  }

  return candles;
}
